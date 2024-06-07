export const errMsg = (e: unknown, fallbackMessage = '') =>
  e instanceof Error ? e.message : fallbackMessage;

export class ParseError extends Error {
  __proto__ = Error;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

interface RoakitErrorOptions {
  code?: number;
  httpStatus?: number;
}

export class RoakitError extends Error {
  __proto__ = Error;

  code?: number;
  httpStatus?: number;

  constructor(message: string, options?: RoakitErrorOptions) {
    super(message);
    Object.setPrototypeOf(this, RoakitError.prototype);
    this.code = options?.code;
    this.httpStatus = options?.httpStatus;
  }
}
