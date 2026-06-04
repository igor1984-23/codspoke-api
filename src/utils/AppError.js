// =============================================================================
// AppError — custom error class with structured response
// =============================================================================

export class AppError extends Error {
  constructor({ status = 500, code = 'internal_error', message, detail }) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}
