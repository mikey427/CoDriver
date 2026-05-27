import { platform } from 'node:os';
import { spawn } from 'node:child_process';
import { AdapterType } from '@driftcode/shared';
import type { HarnessConfig, ToolRequest, ToolResult } from '@driftcode/shared';
import type { Session } from '../session.js';
import { createToolResult } from '../helpers/factories.js';
import { resolveProjectRoot } from '../helpers/project-root.js';

function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

export class TerminalAdapter {
  constructor(
    private config: HarnessConfig,
    private session: Session,
  ) {}

  isAllowed(commandLine: string): { allowed: boolean; reason?: string } {
    const trimmed = commandLine.trim();
    for (const blocked of this.config.terminalBlocklist) {
      if (globMatch(blocked, trimmed) || trimmed.toLowerCase().includes(blocked.toLowerCase())) {
        return { allowed: false, reason: `Command matches blocklist: ${blocked}` };
      }
    }
    for (const allowed of this.config.terminalAllowlist) {
      if (globMatch(allowed, trimmed)) return { allowed: true };
    }
    return { allowed: false, reason: 'Command not in allowlist' };
  }

  async execute(request: ToolRequest): Promise<ToolResult> {
    const start = Date.now();
    const commandLine = String(request.parameters.commandLine ?? request.parameters.literalPayload ?? '');

    if (this.session.emergencyStopActive) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'EMERGENCY_STOP', errorMessage: 'Emergency stop active', durationMs: Date.now() - start });
    }

    const check = this.isAllowed(commandLine);
    if (!check.allowed) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'NOT_ALLOWED', errorMessage: check.reason, durationMs: Date.now() - start });
    }

    const isWindows = platform() === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['/c', commandLine] : ['-lc', commandLine];

    return new Promise((resolve) => {
      const cwd = resolveProjectRoot(this.config, this.session);
      const child = spawn(shell, shellArgs, { cwd, env: process.env, windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => { stdout += c.toString(); });
      child.stderr.on('data', (c) => { stderr += c.toString(); });
      child.on('close', (code) => {
        resolve(createToolResult({
          toolRequest: request,
          success: code === 0,
          message: code === 0 ? 'Command completed' : `Exit code ${code}`,
          structuredData: { stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 8000), exitCode: code },
          errorCode: code === 0 ? undefined : 'NON_ZERO_EXIT',
          durationMs: Date.now() - start,
        }));
      });
      child.on('error', (err) => {
        resolve(createToolResult({ toolRequest: request, success: false, errorCode: 'SPAWN_ERROR', errorMessage: err.message, durationMs: Date.now() - start }));
      });
    });
  }
}
