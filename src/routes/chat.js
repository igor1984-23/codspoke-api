// =============================================================================
// Chat routes — /v1/chat
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

export const chatRouter = Router();

chatRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const sendSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(10000),
});

// ---------------------------------------------------------------------------
// GET /v1/chat/:projectId — fetch message history
// ---------------------------------------------------------------------------
chatRouter.get('/:projectId', async (req, res) => {
  // Verify project belongs to user
  const project = await prisma.project.findFirst({
    where: { id: req.params.projectId, userId: req.user.sub },
  });
  if (!project) {
    throw new AppError({ status: 404, code: 'project_not_found', message: 'Project not found' });
  }

  const messages = await prisma.message.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  res.json(messages);
});

// ---------------------------------------------------------------------------
// POST /v1/chat/send — user sends a message (Spoke replies placeholder)
// ---------------------------------------------------------------------------
chatRouter.post('/send', async (req, res) => {
  const { projectId, message } = sendSchema.parse(req.body);

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: req.user.sub },
  });
  if (!project) {
    throw new AppError({ status: 404, code: 'project_not_found', message: 'Project not found' });
  }

  // Save user message
  await prisma.message.create({
    data: { projectId, userId: req.user.sub, role: 'USER', content: message },
  });

  // TODO: integrate with Spoke (OpenClaw) processing
  // For now — dummy echo
  const reply = await prisma.message.create({
    data: { projectId, userId: req.user.sub, role: 'ASSISTANT', content: `Received: "${message}". (Spoke will process this soon.)` },
  });

  res.status(201).json(reply);
});
