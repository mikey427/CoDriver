#!/usr/bin/env node
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = await createServer();
  console.log(`DriftCode orchestrator running at http://${server.host}:${server.port}`);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start orchestrator:', err);
  process.exit(1);
});
