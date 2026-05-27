import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { HarnessConfig } from '@driftcode/shared';
import { createDefaultHarnessConfig } from '@driftcode/shared';

export class ConfigStore {
  private config: HarnessConfig;
  private configPath: string;

  constructor(cwd = process.cwd()) {
    this.configPath = this.resolveConfigPath(cwd);
    this.config = this.loadOrCreate();
  }

  private resolveConfigPath(cwd: string): string {
    const localDir = join(cwd, '.driftcode');
    const homeDir = join(homedir(), '.driftcode');

    if (existsSync(join(localDir, 'config.json'))) {
      return join(localDir, 'config.json');
    }
    if (existsSync(localDir)) {
      return join(localDir, 'config.json');
    }
    if (existsSync(join(homeDir, 'config.json'))) {
      return join(homeDir, 'config.json');
    }
    return join(homeDir, 'config.json');
  }

  private loadOrCreate(): HarnessConfig {
    const dir = resolve(this.configPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(this.configPath)) {
      try {
        const raw = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw) as HarnessConfig;
        return { ...createDefaultHarnessConfig(), ...parsed };
      } catch {
        return this.writeDefault();
      }
    }

    return this.writeDefault();
  }

  private writeDefault(): HarnessConfig {
    const config = createDefaultHarnessConfig();
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    return config;
  }

  get(): HarnessConfig {
    return { ...this.config };
  }

  getPath(): string {
    return this.configPath;
  }

  update(partial: Partial<HarnessConfig>): HarnessConfig {
    this.config = { ...this.config, ...partial };
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    return this.get();
  }

  save(config: HarnessConfig): HarnessConfig {
    this.config = config;
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    return this.get();
  }
}
