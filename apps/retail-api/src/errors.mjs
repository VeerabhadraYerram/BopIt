export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function unavailableRepository(message = 'Retail database is not configured.') {
  const unavailable = () => {
    throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', message);
  };
  return new Proxy({}, { get: () => unavailable });
}
