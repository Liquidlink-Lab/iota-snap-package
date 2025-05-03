/**
 * Error handling for Iota Snap wallet
 */

export class IotaSnapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IotaSnapError';
  }
}

export class IotaSnapNotInstalledError extends IotaSnapError {
  constructor() {
    super('Iota Snap is not installed');
    this.name = 'IotaSnapNotInstalledError';
  }
}

export class IotaSnapConnectionError extends IotaSnapError {
  constructor(message: string) {
    super(message);
    this.name = 'IotaSnapConnectionError';
  }
}

export class IotaSnapUserRejectedError extends IotaSnapError {
  constructor() {
    super('User rejected the request');
    this.name = 'IotaSnapUserRejectedError';
  }
}

export class IotaSnapUnauthorizedError extends IotaSnapError {
  constructor() {
    super('Unauthorized');
    this.name = 'IotaSnapUnauthorizedError';
  }
}

export class IotaSnapMethodNotFoundError extends IotaSnapError {
  constructor(method: string) {
    super(`Method not found: ${method}`);
    this.name = 'IotaSnapMethodNotFoundError';
  }
}

export function convertError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    if (error.includes('User rejected')) {
      return new IotaSnapUserRejectedError();
    }
    if (error.includes('Unauthorized')) {
      return new IotaSnapUnauthorizedError();
    }
    if (error.includes('Method not found')) {
      return new IotaSnapMethodNotFoundError(error);
    }
    return new IotaSnapError(error);
  }

  return new IotaSnapError('Unknown error');
}
