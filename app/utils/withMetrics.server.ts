import pino, { Logger } from 'pino';
import { setTimeout } from 'timers/promises';

const loggers: Record<string, Logger> = {};
const getLogger = (name: string): Logger => {
  if (!loggers[name]) {
    loggers[name] = pino({ name });
  }
  return loggers[name];
};

export const withMetricsAsync = async <T>(
  func: () => Promise<T>,
  { metricsName }: { metricsName: string }
): Promise<T> => {
  const metricsLogger = getLogger(metricsName);
  const timer = process.hrtime();
  const result = await func();
  metricsLogger.info(`${process.hrtime(timer)[1] / 1000000}ms`);
  return result;
};

// useful for debugging
export const sleep = async (duration: number) => await setTimeout(duration);
