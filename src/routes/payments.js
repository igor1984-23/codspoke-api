// =============================================================================
// Payments routes — /v1/payments (Edsofa integration)
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createPaymentSchema = z.object({
  plan: z.enum(['LITE', 'PRO', 'PREMIUM']),
});

// ---------------------------------------------------------------------------
// Price map
// ---------------------------------------------------------------------------
const PRICES = { LITE: 15, PRO: 49, PREMIUM: 149 };

// ---------------------------------------------------------------------------
// POST /v1/payments/create — create payment link via Edsofa
// ---------------------------------------------------------------------------
paymentsRouter.post('/create', async (req, res) => {
  const { plan } = createPaymentSchema.parse(req.body);
  const amount = PRICES[plan];
  if (!amount) {
    throw new AppError({ status: 400, code: 'invalid_plan', message: `Unknown plan: ${plan}` });
  }

  // Create pending payment record
  const payment = await prisma.payment.create({
    data: {
      userId: req.user.sub,
      amount,
      currency: 'USD',
      plan,
      status: 'PENDING',
    },
  });

  // TODO: call Edsofa API to generate payment link
  // For now return test URL from Edsofa
  const edsofaUrl = `https://edsofa.ai/drc/HKA?order_id=${payment.id}&amount=${amount}&plan=${plan}`;

  res.status(201).json({
    paymentId: payment.id,
    amount,
    plan,
    checkoutUrl: edsofaUrl,
  });
});

// ---------------------------------------------------------------------------
// POST /v1/payments/webhook — Edsofa webhook (called by Edsofa on payment)
// ---------------------------------------------------------------------------
paymentsRouter.post('/webhook', async (req, res) => {
  // TODO: verify Edsofa webhook signature via secret
  const { paymentId, transactionId, status } = req.body;

  if (status === 'completed') {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        edsofaId: transactionId,
        paidAt: new Date(),
        // 30 days subscription from now
        subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Update user's plan
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (payment) {
      await prisma.user.update({
        where: { id: payment.userId },
        data: { plan: payment.plan },
      });
    }
  } else if (status === 'failed') {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED' },
    });
  }

  res.json({ received: true });
});

// ---------------------------------------------------------------------------
// GET /v1/payments/history — payment history for current user
// ---------------------------------------------------------------------------
paymentsRouter.get('/history', async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      currency: true,
      plan: true,
      status: true,
      createdAt: true,
      paidAt: true,
      subscriptionEndsAt: true,
    },
  });
  res.json(payments);
});
