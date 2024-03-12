export const errMsg = (e: unknown, fallbackMessage: string) =>
  e instanceof Error ? e.message : fallbackMessage;

export class ParseError extends Error {
  __proto__ = Error;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}
