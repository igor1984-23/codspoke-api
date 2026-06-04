// =============================================================================
// Global error handler middleware
// =============================================================================

import { AppError } from '../utils/AppError.js';

export function errorHandler(err, _req, res, _next) {
  // Log every error in dev
  if (process.env.NODE_ENV !== 'production') {
    console.error('[error]', err);
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      detail: err.detail || undefined,
    });
  }

  // Zod validation errors
  if (err?.issues && Array.isArray(err.issues)) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Request validation failed',
      detail: err.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  // Prisma known request errors (unique constraint, FK, etc.)
  if (err?.code && err.code.startsWith('P')) {
    return res.status(409).json({
      error: 'db_constraint',
      message: err.meta?.cause || 'Database conflict',
    });
  }

  // Fallback
  res.status(err.status || 500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred',
  });
}
