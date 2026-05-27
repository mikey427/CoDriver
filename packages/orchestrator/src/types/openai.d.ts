declare module 'openai' {
  export default class OpenAI {
    constructor(config: { apiKey: string });
    chat: {
      completions: {
        create(args: unknown): Promise<unknown>;
      };
    };
  }
}
