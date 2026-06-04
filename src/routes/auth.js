// =============================================================================
// Auth routes — /v1/auth
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../utils/prisma.js';
import { config } from '../utils/config.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyPassword, signAccessToken, generateVerifyToken } from '../services/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js';

export const authRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  token: z.string().length(64), // hex of 32 bytes
});

// ---------------------------------------------------------------------------
// POST /v1/auth/signup
// ---------------------------------------------------------------------------
authRouter.post('/signup', async (req, res) => {
  const { email, password } = signupSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  // Check existing (no enum leak — generic message)
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new AppError({ status: 409, code: 'email_taken', message: 'This email is already registered' });
  }

  const passwordHash = await hashPassword(password);
  const verifyToken = generateVerifyToken();

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      verifyToken,
      verifySentAt: new Date(),
      trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h trial
    },
  });

  // Fire & forget email (never block signup on email failure)
  sendVerificationEmail({ to: normalizedEmail, token: verifyToken }).catch(err => {
    console.error('[auth] failed to send verification email', err);
  });

  res.status(201).json({ message: 'Account created. Check your email to verify.' });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/verify
// ---------------------------------------------------------------------------
authRouter.post('/verify', async (req, res) => {
  const { token } = verifySchema.parse(req.body);

  const user = await prisma.user.findFirst({ where: { verifyToken: token } });
  if (!user) {
    throw new AppError({ status: 400, code: 'invalid_verify_token', message: 'Invalid or expired verification link' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyToken: null, verifySentAt: null },
  });

  res.json({ message: 'Email verified. You can now use CodSpoke.' });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/login
// ---------------------------------------------------------------------------
authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new AppError({ status: 401, code: 'invalid_credentials', message: 'Invalid email or password' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError({ status: 401, code: 'invalid_credentials', message: 'Invalid email or password' });
  }

  if (!user.emailVerified) {
    throw new AppError({ status: 403, code: 'email_not_verified', message: 'Verify your email before logging in' });
  }

  const token = signAccessToken({ userId: user.id, email: user.email, plan: user.plan });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
    },
  });
});

// ---------------------------------------------------------------------------
// Schemas (continued)
// ---------------------------------------------------------------------------
const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().length(64),
  password: z.string().min(8).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// ---------------------------------------------------------------------------
// POST /v1/auth/forgot — send password reset email
// ---------------------------------------------------------------------------
authRouter.post('/forgot', async (req, res) => {
  const { email } = forgotSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  // Always return 200 — don't leak whether email exists
  if (!user) {
    return res.json({ message: 'If this email is registered, you will receive a reset link.' });
  }

  const resetToken = generateVerifyToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { verifyToken: resetToken, verifySentAt: new Date() },
  });

  sendPasswordResetEmail({ to: normalizedEmail, token: resetToken }).catch(err => {
    console.error('[auth] failed to send reset email', err);
  });

  res.json({ message: 'If this email is registered, you will receive a reset link.' });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/reset — reset password with token
// ---------------------------------------------------------------------------
authRouter.post('/reset', async (req, res) => {
  const { token, password } = resetSchema.parse(req.body);

  const user = await prisma.user.findFirst({ where: { verifyToken: token } });
  if (!user) {
    throw new AppError({ status: 400, code: 'invalid_reset_token', message: 'Invalid or expired reset link' });
  }

  // Expire token after 1 hour
  if (user.verifySentAt && Date.now() - user.verifySentAt.getTime() > 3600_000) {
    throw new AppError({ status: 400, code: 'expired_reset_token', message: 'Reset link has expired. Request a new one.' });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, verifyToken: null, verifySentAt: null },
  });

  res.json({ message: 'Password has been reset. You can now log in.' });
});

// ---------------------------------------------------------------------------
// PATCH /v1/auth/change-password — change password when logged in
// ---------------------------------------------------------------------------
authRouter.patch('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) {
    throw new AppError({ status: 404, code: 'user_not_found', message: 'User not found' });
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError({ status: 401, code: 'invalid_password', message: 'Current password is incorrect' });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  res.json({ message: 'Password changed successfully.' });
});

// ---------------------------------------------------------------------------
// GET /v1/auth/me
// ---------------------------------------------------------------------------
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, email: true, plan: true, trialEndsAt: true, emailVerified: true, createdAt: true },
  });
  if (!user) {
    throw new AppError({ status: 404, code: 'user_not_found', message: 'User not found' });
  }
  res.json(user);
});
