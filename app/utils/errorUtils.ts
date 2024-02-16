export const errMsg = (e: unknown, fallbackMessage: string) =>
  e instanceof Error ? e.message : fallbackMessage;
