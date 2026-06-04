// =============================================================================
// Projects routes — /v1/projects
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth); // all project routes require auth

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createSchema = z.object({
  title: z.string().max(200).optional().default(''),
  description: z.string().max(10000),
});

const updateSchema = z.object({
  title: z.string().max(200).optional(),
  status: z.enum(['PENDING', 'BUILDING', 'DEPLOYED', 'FAILED']).optional(),
  deployUrl: z.string().url().optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET /v1/projects — list user's projects
// ---------------------------------------------------------------------------
projectsRouter.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.user.sub },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      deployUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  res.json(projects);
});

// ---------------------------------------------------------------------------
// GET /v1/projects/:id
// ---------------------------------------------------------------------------
projectsRouter.get('/:id', async (req, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.user.sub },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      deployUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!project) {
    throw new AppError({ status: 404, code: 'project_not_found', message: 'Project not found' });
  }
  res.json(project);
});

// ---------------------------------------------------------------------------
// POST /v1/projects — create new project
// ---------------------------------------------------------------------------
projectsRouter.post('/', async (req, res) => {
  const { title, description } = createSchema.parse(req.body);

  const project = await prisma.project.create({
    data: { userId: req.user.sub, title, description },
    select: { id: true, title: true, status: true, createdAt: true },
  });

  res.status(201).json(project);
});

// ---------------------------------------------------------------------------
// PATCH /v1/projects/:id
// ---------------------------------------------------------------------------
projectsRouter.patch('/:id', async (req, res) => {
  const data = updateSchema.parse(req.body);

  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.user.sub },
  });
  if (!project) {
    throw new AppError({ status: 404, code: 'project_not_found', message: 'Project not found' });
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
    select: { id: true, title: true, status: true, deployUrl: true, updatedAt: true },
  });

  res.json(updated);
});

// ---------------------------------------------------------------------------
// DELETE /v1/projects/:id
// ---------------------------------------------------------------------------
projectsRouter.delete('/:id', async (req, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.user.sub },
  });
  if (!project) {
    throw new AppError({ status: 404, code: 'project_not_found', message: 'Project not found' });
  }

  await prisma.project.delete({ where: { id: project.id } });
  res.status(204).end();
});
