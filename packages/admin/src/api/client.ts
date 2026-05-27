import type {
  CommandAliasRow,
  ConfigResponse,
  DashboardState,
  EventsQuery,
  EventsResponse,
  HarnessConfig,
  ModesResponse,
  OpenAiSettingsView,
  RuntimeEvent,
  SafetyView,
  SttSettingsView,
} from './types';

const DEFAULT_BASE = 'http://127.0.0.1:17345';

function resolveBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }
  return import.meta.env.VITE_ORCHESTRATOR_URL ?? DEFAULT_BASE;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = resolveBaseUrl();
  const url = `${base}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(`API ${response.status}: ${response.statusText}`, response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function mapConfigToSafety(config: HarnessConfig): SafetyView {
  return {
    locked: true,
    confirmationStrictness: 'normal',
    emergencyPhrases: config.emergencyPhrases,
    terminalAllowlist: config.terminalAllowlist,
    terminalBlocklist: config.terminalBlocklist,
    sessionCostBudgetUsd: config.sessionCostBudgetUsd,
  };
}

function mapConfigToStt(config: HarnessConfig): SttSettingsView {
  return {
    providerId: 'default',
    wakePhraseEnabled: false,
    customVocabulary: config.customVocabulary,
    speechCorrections: config.speechCorrections,
  };
}

function mapConfigToOpenAi(config: HarnessConfig & { openAiApiKey?: string }): OpenAiSettingsView {
  const masked = config.openAiApiKey;
  return {
    hasApiKey: Boolean(masked && masked !== '***configured***'),
    apiKeyMasked: masked === '***configured***' ? '••••••••••••configured' : masked ?? '',
    defaultModel: config.openAiModel,
    sessionBudgetUsd: config.sessionCostBudgetUsd,
  };
}

function mapCorrectionsToAliases(corrections: HarnessConfig['speechCorrections']): CommandAliasRow[] {
  return corrections.map((c, index) => ({
    id: `correction-${index}`,
    aliasPhrases: [c.misrecognition],
    targetCommandId: c.correction,
    targetCommandName: c.correction,
    modeAllowlist: [],
    priority: 100 - index,
    enabled: true,
    requiresExactMatch: true,
    notes: 'Speech correction (STT alias)',
  }));
}

export const api = {
  getDashboardState(): Promise<DashboardState> {
    return request<DashboardState>('/api/dashboard');
  },

  getDashboardStreamUrl(): string {
    const base = resolveBaseUrl();
    return `${base}/api/events/stream`;
  },

  async getEvents(query: EventsQuery = {}): Promise<EventsResponse> {
    const limit = query.limit ?? 200;
    const res = await request<{ events: RuntimeEvent[] }>(
      `/api/logs/events${buildQuery({ limit })}`,
    );
    let events = res.events;

    if (query.severity) {
      events = events.filter((e) => e.severity === query.severity);
    }
    if (query.subsystem) {
      events = events.filter((e) => e.subsystem === query.subsystem);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      events = events.filter(
        (e) =>
          e.eventType.toLowerCase().includes(q) ||
          (e.message?.toLowerCase().includes(q) ?? false),
      );
    }

    return { events, total: events.length };
  },

  async getAliases(): Promise<CommandAliasRow[]> {
    try {
      return await request<CommandAliasRow[]>('/api/commands/aliases');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        const { config } = await api.getConfig();
        return mapCorrectionsToAliases(config.speechCorrections);
      }
      throw err;
    }
  },

  async getModes(): Promise<ModesResponse> {
    const res = await request<{ modes: ModesResponse['modes'] }>('/api/modes');
    const dashboard = await api.getDashboardState().catch(() => null);
    return {
      modes: res.modes,
      activeModeId: dashboard?.activeModeId,
    };
  },

  async getSafetyConfig(): Promise<SafetyView> {
    const { config } = await api.getConfig();
    return mapConfigToSafety(config);
  },

  async getSttSettings(): Promise<SttSettingsView> {
    const { config } = await api.getConfig();
    return mapConfigToStt(config);
  },

  async getOpenAiSettings(): Promise<OpenAiSettingsView> {
    const { config } = await api.getConfig();
    return mapConfigToOpenAi(config);
  },

  getConfig(): Promise<ConfigResponse> {
    return request<ConfigResponse>('/api/config');
  },

  updateConfig(partial: Partial<HarnessConfig>): Promise<ConfigResponse> {
    return request<ConfigResponse>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(partial),
    });
  },

  async updateSttSettings(settings: Partial<SttSettingsView>): Promise<SttSettingsView> {
    const partial: Partial<HarnessConfig> = {};
    if (settings.customVocabulary) partial.customVocabulary = settings.customVocabulary;
    if (settings.speechCorrections) partial.speechCorrections = settings.speechCorrections;
    const { config } = await api.updateConfig(partial);
    return mapConfigToStt(config);
  },

  async updateOpenAiSettings(settings: {
    apiKey?: string;
    openAiModel?: string;
    sessionCostBudgetUsd?: number;
  }): Promise<OpenAiSettingsView> {
    const partial: Partial<HarnessConfig> = {};
    if (settings.apiKey) partial.openAiApiKey = settings.apiKey;
    if (settings.openAiModel) partial.openAiModel = settings.openAiModel;
    if (settings.sessionCostBudgetUsd != null) {
      partial.sessionCostBudgetUsd = settings.sessionCostBudgetUsd;
    }
    const { config } = await api.updateConfig(partial);
    return mapConfigToOpenAi(config);
  },
};

export function parseStreamMessage(data: string): DashboardState | RuntimeEvent | null {
  try {
    const parsed = JSON.parse(data) as {
      type?: string;
      payload?: unknown;
    };
    if (parsed.type === 'dashboard.state' && parsed.payload) {
      return parsed.payload as DashboardState;
    }
    if (parsed.type === 'runtime.event' && parsed.payload) {
      return parsed.payload as RuntimeEvent;
    }
    if (parsed.type === 'dashboard' && parsed.payload) {
      return parsed.payload as DashboardState;
    }
    if ('activeModeId' in parsed) {
      return parsed as DashboardState;
    }
    return null;
  } catch {
    return null;
  }
}
