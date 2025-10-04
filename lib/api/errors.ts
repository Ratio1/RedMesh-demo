export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function ensure(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) {
    throw new ApiError(status, message);
  }
}
