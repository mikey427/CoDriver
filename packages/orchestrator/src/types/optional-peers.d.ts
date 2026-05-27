declare module 'playwright' {
  export const chromium: {
    launchPersistentContext(userDataDir: string, opts: Record<string, unknown>): Promise<unknown>;
  };
}

declare module 'obs-websocket-js' {
  export default class OBSWebSocket {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    call(requestType: string, requestData?: Record<string, unknown>): Promise<{ requestStatus: { code: number }; responseData?: Record<string, unknown> }>;
  }
}
