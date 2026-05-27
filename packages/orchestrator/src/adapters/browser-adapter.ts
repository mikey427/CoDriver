import path from 'node:path';
import { DevServerStatus, RuntimeSubsystem } from '@driftcode/shared';
import type { HarnessConfig, ToolRequest, ToolResult } from '@driftcode/shared';
import type { EventBus } from '../event-bus.js';
import type { Session } from '../session.js';
import { createToolResult } from '../helpers/factories.js';

type PlaywrightPage = {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  title(): Promise<string>;
  url(): string;
  on(event: string, handler: (msg: { text?: () => string; type?: () => string }) => void): void;
  close(): Promise<void>;
};

type PlaywrightBrowser = {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
};

type PlaywrightChromium = {
  launchPersistentContext(userDataDir: string, opts: Record<string, unknown>): Promise<PlaywrightBrowser & { pages(): PlaywrightPage[] }>;
};

export class BrowserAdapter {
  private browser: (PlaywrightBrowser & { pages(): PlaywrightPage[] }) | null = null;
  private page: PlaywrightPage | null = null;
  private consoleErrors: string[] = [];

  constructor(
    private config: HarnessConfig,
    private session: Session,
    private eventBus: EventBus,
  ) {}

  async ensureBrowser(): Promise<boolean> {
    if (this.page) return true;
    try {
      const pw = await import('playwright') as { chromium: PlaywrightChromium };
      const chromium = pw.chromium;
      const profileDir = path.resolve(this.config.browserProfilePath ?? '.driftcode/browser-profile');
      this.browser = await chromium.launchPersistentContext(profileDir, {
        headless: this.config.browserHeadless ?? true,
        viewport: { width: 1280, height: 720 },
        args: ['--disable-sync', '--no-default-browser-check'],
      });
      this.page = this.browser.pages()[0] ?? (await this.browser.newPage());
      this.page.on('console', (msg) => {
        if (msg.type?.() === 'error') {
          const t = msg.text?.() ?? '';
          this.consoleErrors.push(t);
          if (this.consoleErrors.length > 50) this.consoleErrors.shift();
        }
      });
      this.session.browserState = { connected: true, url: this.page.url() };
      this.eventBus.emit('adapter.connected', { adapter: 'browser' }, { subsystem: RuntimeSubsystem.Browser });
      return true;
    } catch {
      return false;
    }
  }

  async executeToolRequest(request: ToolRequest): Promise<ToolResult> {
    if (this.session.emergencyStopActive) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'EMERGENCY_STOP', errorMessage: 'Emergency stop active' });
    }

    const ok = await this.ensureBrowser();
    if (!ok || !this.page) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'NOT_CONNECTED', errorMessage: 'Playwright not available — npm install playwright && npx playwright install chromium' });
    }

    const start = Date.now();
    try {
      const action = request.action;
      if (action === 'browser.navigate' || action === 'browser.open') {
        const url = String(request.parameters.url ?? this.config.devServerUrl ?? 'http://localhost:5173');
        if (!this.isUrlAllowed(url)) {
          return createToolResult({ toolRequest: request, success: false, errorCode: 'NAVIGATION_BLOCKED', errorMessage: 'URL not allowlisted', durationMs: Date.now() - start });
        }
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        this.session.browserState = { connected: true, url: this.page.url(), domain: new URL(this.page.url()).hostname };
        return createToolResult({ toolRequest: request, success: true, message: `Opened ${this.page.url()}`, durationMs: Date.now() - start });
      }
      if (action === 'browser.click') {
        await this.page.click(String(request.parameters.selector ?? request.parameters.target));
        return createToolResult({ toolRequest: request, success: true, message: 'Clicked', durationMs: Date.now() - start });
      }
      if (action === 'browser.fill') {
        await this.page.fill(String(request.parameters.selector ?? request.parameters.target), String(request.parameters.value ?? ''));
        return createToolResult({ toolRequest: request, success: true, message: 'Filled', durationMs: Date.now() - start });
      }
      if (action === 'browser.readConsole') {
        const errors = [...this.consoleErrors];
        return createToolResult({ toolRequest: request, success: true, message: `${errors.length} console errors`, structuredData: { errors }, durationMs: Date.now() - start });
      }
      if (action === 'browser.back') {
        await (this.page as PlaywrightPage & { goBack(): Promise<void> }).goBack();
        this.session.browserState = { connected: true, url: this.page.url(), domain: new URL(this.page.url()).hostname };
        return createToolResult({ toolRequest: request, success: true, message: 'Navigated back', durationMs: Date.now() - start });
      }
      if (action === 'browser.assertText') {
        const title = await this.page.title();
        const expected = String(request.parameters.text ?? '');
        const pass = title.includes(expected) || this.page.url().includes(expected);
        return createToolResult({ toolRequest: request, success: pass, message: pass ? 'Pass' : 'Fail', durationMs: Date.now() - start });
      }
      return createToolResult({ toolRequest: request, success: false, errorCode: 'UNKNOWN_ACTION', errorMessage: action, durationMs: Date.now() - start });
    } catch (err) {
      return createToolResult({ toolRequest: request, success: false, errorCode: 'BROWSER_ERROR', errorMessage: err instanceof Error ? err.message : 'Browser error', durationMs: Date.now() - start });
    }
  }

  private isUrlAllowed(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
      return (this.config.browserDomainAllowlist ?? []).some((d) => u.hostname.endsWith(d));
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.page?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.page = null;
    this.browser = null;
    this.session.browserState = { connected: false };
  }
}
