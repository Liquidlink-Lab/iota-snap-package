/**
 * Error handling for Sui Snap wallet
 */

export class SuiSnapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuiSnapError';
  }
}

export class SuiSnapNotInstalledError extends SuiSnapError {
  constructor() {
    super('Sui Snap is not installed');
    this.name = 'SuiSnapNotInstalledError';
  }
}

export class SuiSnapConnectionError extends SuiSnapError {
  constructor(message: string) {
    super(message);
    this.name = 'SuiSnapConnectionError';
  }
}

export class SuiSnapUserRejectedError extends SuiSnapError {
  constructor() {
    super('User rejected the request');
    this.name = 'SuiSnapUserRejectedError';
  }
}

export class SuiSnapUnauthorizedError extends SuiSnapError {
  constructor() {
    super('Unauthorized');
    this.name = 'SuiSnapUnauthorizedError';
  }
}

export class SuiSnapMethodNotFoundError extends SuiSnapError {
  constructor(method: string) {
    super(`Method not found: ${method}`);
    this.name = 'SuiSnapMethodNotFoundError';
  }
}

export function convertError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    if (error.includes('User rejected')) {
      return new SuiSnapUserRejectedError();
    }
    if (error.includes('Unauthorized')) {
      return new SuiSnapUnauthorizedError();
    }
    if (error.includes('Method not found')) {
      return new SuiSnapMethodNotFoundError(error);
    }
    return new SuiSnapError(error);
  }

  return new SuiSnapError('Unknown error');
}
