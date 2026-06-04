// =============================================================================
// requireAuth — extracts & validates JWT from Authorization header
// =============================================================================

import { verifyAccessToken } from '../services/auth.js';
import { AppError } from '../utils/AppError.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError({ status: 401, code: 'missing_auth', message: 'Authorization header required' });
  }
  const token = header.slice(7);
  req.user = verifyAccessToken(token);
  next();
}
