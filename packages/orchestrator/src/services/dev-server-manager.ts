import { spawn, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import http from 'node:http';
import { DevServerStatus } from '@driftcode/shared';
import type { HarnessConfig } from '@driftcode/shared';
import type { Session } from '../session.js';
import { resolveProjectRoot } from '../helpers/project-root.js';

export class DevServerManager {
  private process?: ChildProcess;

  constructor(
    private config: HarnessConfig,
    private session: Session,
  ) {}

  get status(): DevServerStatus | string {
    return this.session.devServerStatus;
  }

  async start(): Promise<{ success: boolean; message: string }> {
    if (this.process) {
      return { success: true, message: 'Dev server already running' };
    }

    const command = this.config.devServerCommand ?? 'npm run dev';
    this.session.devServerStatus = DevServerStatus.Starting;

    const isWindows = platform() === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['/c', command] : ['-lc', command];
    const cwd = resolveProjectRoot(this.config, this.session);

    this.process = spawn(shell, shellArgs, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

    this.process.stdout?.on('data', (chunk) => {
      const line = chunk.toString();
      if (/ready|listening|Local:/i.test(line)) {
        this.session.devServerStatus = DevServerStatus.Ready;
      }
    });

    this.process.on('exit', () => {
      this.process = undefined;
      this.session.devServerStatus = DevServerStatus.Stopped;
    });

    const ready = await this.waitForReady(this.config.devServerUrl ?? `http://localhost:${this.config.devServerPort ?? 5173}`, this.config.devServerReadyTimeoutMs ?? 60_000);
    this.session.devServerStatus = ready ? DevServerStatus.Ready : DevServerStatus.Error;
    return { success: ready, message: ready ? 'Dev server ready' : 'Dev server failed to become ready' };
  }

  async stop(): Promise<{ success: boolean; message: string }> {
    if (!this.process) {
      this.session.devServerStatus = DevServerStatus.Stopped;
      return { success: true, message: 'Dev server not running' };
    }
    this.process.kill('SIGTERM');
    this.process = undefined;
    this.session.devServerStatus = DevServerStatus.Stopped;
    return { success: true, message: 'Dev server stopped' };
  }

  private waitForReady(url: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve) => {
      const tick = () => {
        if (Date.now() > deadline) {
          resolve(this.session.devServerStatus === DevServerStatus.Ready);
          return;
        }
        const req = http.get(url, (res) => {
          res.resume();
          resolve(res.statusCode != null && res.statusCode < 500);
        });
        req.on('error', () => setTimeout(tick, 1500));
        req.setTimeout(2000, () => {
          req.destroy();
          setTimeout(tick, 1500);
        });
      };
      tick();
    });
  }
}
