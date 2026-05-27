import { resolve } from 'node:path';
import type { HarnessConfig } from '@driftcode/shared';
import type { Session } from '../session.js';

export function resolveProjectRoot(config: HarnessConfig, session: Session): string {
  const root = session.workspaceRoot ?? config.projectRoot ?? process.cwd();
  return resolve(root);
}
