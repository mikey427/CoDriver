import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, watch } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { ConnectionHealth, FocusTarget, RuntimeSubsystem } from '@driftcode/shared';
import type { HarnessConfig } from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';
import type { CommandRouter } from '../router/command-router.js';
import type { Session } from '../session.js';
import type { SttManager } from '../stt/stt-manager.js';
import type pino from 'pino';

export interface SpeechInputStatus {
  connected: boolean;
  pttActive: boolean;
  providerId: string;
  inboxPath: string;
  lastTranscript?: string;
  lastProcessedAt?: string;
  whisperAvailable?: boolean;
}

export class SpeechInputService {
  private pttActive = false;
  private pttStartedAt?: string;
  private pttBuffer = '';
  private watcher?: ReturnType<typeof watch>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private status: SpeechInputStatus;
  private processedFiles = new Set<string>();

  constructor(
    private config: HarnessConfig,
    private session: Session,
    private router: CommandRouter,
    private eventBus: EventBus,
    private log: pino.Logger,
    private configPath?: string,
    private stt?: SttManager,
  ) {
    this.status = {
      connected: false,
      pttActive: false,
      providerId: config.sttProviderId ?? 'http-inbox',
      inboxPath: this.resolveInboxPath(),
    };
  }

  start(): void {
    const inbox = this.resolveInboxPath();
    if (!existsSync(inbox)) {
      mkdirSync(inbox, { recursive: true });
    }
    this.status.inboxPath = inbox;
    this.status.connected = true;

    try {
      this.watcher = watch(inbox, (_, filename) => {
        if (!filename || !filename.endsWith('.txt')) return;
        void this.processInboxFile(join(inbox, filename));
      });
      this.log.info({ inbox }, 'Speech inbox watcher started');
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as NodeJS.ErrnoException).code) : '';
      this.log.warn({ err, inbox }, 'Speech inbox watch unavailable — using poll fallback');
      this.pollTimer = setInterval(() => this.pollInbox(inbox), 2000);
      if (code !== 'ENOSPC') {
        this.log.debug('Inbox poll interval 2s');
      }
    }

    this.eventBus.emit('adapter.connected', { adapter: 'stt' }, { subsystem: RuntimeSubsystem.Speech });
  }

  stop(): void {
    this.watcher?.close();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.status.connected = false;
    this.eventBus.emit('adapter.disconnected', { adapter: 'stt' }, { subsystem: RuntimeSubsystem.Speech });
  }

  getStatus(): SpeechInputStatus {
    return {
      ...this.status,
      pttActive: this.pttActive,
      whisperAvailable: this.config.sttProviderId === 'openai-whisper' && Boolean(this.config.openAiApiKey),
    };
  }

  refreshConfig(config: HarnessConfig): void {
    this.config = config;
    this.status.providerId = config.sttProviderId ?? 'http-inbox';
    this.stt?.updateConfig(config);
  }

  async transcribeAndIngest(audio: Buffer, mimeType?: string, processAsCommand = true): Promise<{ transcript: string; processed: boolean }> {
    if (!this.stt) throw new Error('STT manager not configured');
    const result = await this.stt.transcribe(audio, { mimeType, processAsCommand });
    if (!result.text) return { transcript: '', processed: false };
    if (processAsCommand) {
      await this.ingestText(result.text, 'whisper');
    }
    return { transcript: result.text, processed: processAsCommand };
  }

  getConnectionHealth(): ConnectionHealth {
    return this.status.connected ? ConnectionHealth.Connected : ConnectionHealth.Disconnected;
  }

  pttDown(source: 'voice' | 'button' | 'api' = 'api'): void {
    this.pttActive = true;
    this.pttStartedAt = new Date().toISOString();
    this.pttBuffer = '';
    this.eventBus.emit('utterance.received', { rawText: `[PTT down:${source}]` }, { subsystem: RuntimeSubsystem.Speech });
  }

  async pttUp(text?: string): Promise<{ processed: boolean; transcript?: string }> {
    const durationMs = this.pttStartedAt
      ? Date.now() - new Date(this.pttStartedAt).getTime()
      : 0;
    this.pttActive = false;
    const transcript = (text ?? this.pttBuffer).trim();
    this.log.debug({ durationMs, transcript: transcript.slice(0, 80) }, 'PTT up');

    if (!transcript) {
      return { processed: false };
    }

    this.status.lastTranscript = transcript;
    this.status.lastProcessedAt = new Date().toISOString();
    await this.router.processUtterance(transcript);
    return { processed: true, transcript };
  }

  async ingestText(text: string, source = 'inbox'): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.status.lastTranscript = trimmed;
    this.status.lastProcessedAt = new Date().toISOString();
    this.eventBus.emit('utterance.received', { rawText: trimmed }, { subsystem: RuntimeSubsystem.Speech, message: `Speech inbox (${source})` });
    await this.router.processUtterance(trimmed);
  }

  private resolveInboxPath(): string {
    const configured = this.config.speechInboxPath;
    const configDir = this.configPath ? dirname(this.configPath) : join(homedir(), '.driftcode');
    if (configured && (configured.startsWith('/') || /^[A-Za-z]:/.test(configured))) {
      return configured;
    }
    if (configured && configured !== '.driftcode/inbox') {
      return resolve(configDir, '..', configured);
    }
    return join(configDir, 'inbox');
  }

  private pollInbox(inbox: string): void {
    if (!existsSync(inbox)) return;
    for (const name of readdirSync(inbox)) {
      if (!name.endsWith('.txt')) continue;
      const full = join(inbox, name);
      if (this.processedFiles.has(full)) continue;
      void this.processInboxFile(full);
    }
  }

  private async processInboxFile(filePath: string): Promise<void> {
    if (this.processedFiles.has(filePath)) return;
    this.processedFiles.add(filePath);
    try {
      await new Promise((r) => setTimeout(r, 50));
      if (!existsSync(filePath)) return;
      const text = readFileSync(filePath, 'utf-8').trim();
      if (text) {
        await this.ingestText(text, 'inbox');
      }
      const processedDir = join(this.resolveInboxPath(), 'processed');
      if (!existsSync(processedDir)) mkdirSync(processedDir, { recursive: true });
      const dest = join(processedDir, `${Date.now()}-${filePath.split(/[/\\]/).pop()}`);
      renameSync(filePath, dest);
    } catch (err) {
      this.log.warn({ err, filePath }, 'Failed to process speech inbox file');
    }
  }
}

/** Best-effort OS focus for VS Code (Windows-first). */
export async function focusApplication(target: FocusTarget | string): Promise<{ success: boolean; message: string }> {
  const { spawn } = await import('node:child_process');
  const { platform } = await import('node:os');

  if (target === FocusTarget.Vscode || target === 'vscode') {
    if (platform() === 'win32') {
      return new Promise((resolve) => {
        spawn(
          'powershell',
          ['-Command', "(Get-Process Code -ErrorAction SilentlyContinue | Select-Object -First 1).MainWindowHandle | ForEach-Object { if ($_ -ne 0) { Add-Type @' using System; using System.Runtime.InteropServices; public class W { [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd); } '@; [W]::SetForegroundWindow($_) } }"],
          { stdio: 'ignore', windowsHide: true },
        ).on('close', () => resolve({ success: true, message: 'Focused VS Code' }));
      });
    }
    if (platform() === 'linux') {
      return new Promise((resolve) => {
        spawn('sh', ['-c', 'wmctrl -a "Visual Studio Code" 2>/dev/null || wmctrl -a "Code" 2>/dev/null || true'], { stdio: 'ignore' })
          .on('close', (code) => resolve({ success: code === 0, message: code === 0 ? 'Focused VS Code' : 'Focus VS Code (install wmctrl on Linux)' }));
      });
    }
    return { success: true, message: 'Focus target set to VS Code' };
  }

  return { success: true, message: `Focus set to ${target}` };
}
