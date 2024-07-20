import pino from 'pino';

export const getLogger = (name: string) =>
  pino({
    name,
    ...(process.env?.LOG_LEVEL && { level: process.env.LOG_LEVEL }),
  });
