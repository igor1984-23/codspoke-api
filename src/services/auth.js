// =============================================================================
// Auth helpers — password hashing, JWT, email verification tokens
// =============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../utils/config.js';
import { AppError } from '../utils/AppError.js';

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------
const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
export function signAccessToken({ userId, email, plan }) {
  return jwt.sign(
    { sub: userId, email, plan },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch {
    throw new AppError({ status: 401, code: 'invalid_token', message: 'Token expired or invalid' });
  }
}

// ---------------------------------------------------------------------------
// Email verification tokens (opaque, one-time)
// ---------------------------------------------------------------------------
export function generateVerifyToken() {
  return crypto.randomBytes(32).toString('hex');
}
