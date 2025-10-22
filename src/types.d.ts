declare module '@browserbasehq/sdk/playwright' {
  export const connectPlaywright: (opts: { sessionId: string; apiKey: string }) => Promise<import('playwright-core').Browser>;
}


