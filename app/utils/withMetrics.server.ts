import type { Logger } from 'pino';
import { getLogger } from './loggerUtils.server';

const loggers: Record<string, Logger> = {};
const getMetricsLogger = (name: string): Logger => {
  if (!loggers[name]) {
    loggers[name] = getLogger(name);
  }
  return loggers[name];
};

export const withMetricsAsync = async <T>(
  func: () => Promise<T>,
  { metricsName }: { metricsName: string }
): Promise<T> => {
  const metricsLogger = getMetricsLogger(metricsName);
  const timer = process.hrtime();
  const result = await func();
  metricsLogger.info(`${process.hrtime(timer)[1] / 1000000}ms`);
  return result;
};
