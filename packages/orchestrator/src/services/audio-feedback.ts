import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import type pino from 'pino';

export type FeedbackTone = 'success' | 'error' | 'confirm' | 'mode' | 'emergency';

/** Short audio feedback — private operator channel only. */
export class AudioFeedback {
  private ttsProcesses = new Set<ReturnType<typeof spawn>>();

  constructor(private log: pino.Logger) {}

  stopTts(): void {
    for (const proc of this.ttsProcesses) {
      proc.kill('SIGTERM');
    }
    this.ttsProcesses.clear();
  }

  private trackTts(proc: ReturnType<typeof spawn>): void {
    this.ttsProcesses.add(proc);
    proc.on('exit', () => this.ttsProcesses.delete(proc));
  }

  beep(tone: FeedbackTone): void {
    const freq = { success: 880, error: 220, confirm: 660, mode: 440, emergency: 150 }[tone];
    if (platform() === 'win32') {
      spawn('powershell', ['-Command', `[console]::beep(${freq},120)`], { stdio: 'ignore', windowsHide: true }).unref();
      return;
    }
    if (platform() === 'linux') {
      spawn('sh', ['-c', `printf '\\a' || paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || true`], { stdio: 'ignore' }).unref();
      return;
    }
    process.stdout.write('\u0007');
    this.log.debug({ tone, freq }, 'audio beep');
  }

  speakBrief(text: string, maxWords = 8): void {
    const words = text.split(/\s+/).slice(0, maxWords).join(' ');
    if (platform() === 'win32') {
      const proc = spawn('powershell', ['-Command', `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${words.replace(/'/g, "''")}')`], { stdio: 'ignore', windowsHide: true });
      proc.unref();
      this.trackTts(proc);
      return;
    }
    if (platform() === 'linux') {
      const proc = spawn('sh', ['-c', `command -v spd-say >/dev/null && spd-say '${words.replace(/'/g, "'\\''")}' || espeak '${words.replace(/'/g, "'\\''")}' 2>/dev/null || true`], { stdio: 'ignore' });
      proc.unref();
      this.trackTts(proc);
    }
  }
}
