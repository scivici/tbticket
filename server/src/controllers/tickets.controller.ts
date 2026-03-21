import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import * as ticketService from '../services/ticket.service';
import { analyzeTicket } from '../services/claude.service';
import { getBestEngineer } from '../services/assignment.service';
import { config } from '../config';
import { getDb } from '../db/connection';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function createTicket(req: AuthenticatedRequest, res: Response): void {
  try {
    let customerId = req.user?.userId;

    // Handle anonymous/unauthenticated submission
    if (!customerId) {
      const { email, name } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email is required for anonymous submissions' });
        return;
      }
      const db = getDb();
      let customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email) as any;
      if (!customer) {
        const result = db.prepare(
          'INSERT INTO customers (email, name, is_anonymous) VALUES (?, ?, 1)'
        ).run(email, name || 'Anonymous');
        customerId = result.lastInsertRowid as number;
      } else {
        customerId = customer.id;
      }
    }

    const { productId, categoryId, subject, description } = req.body;
    let answers = req.body.answers;

    if (!productId || !categoryId || !subject || !description) {
      res.status(400).json({ error: 'productId, categoryId, subject, and description are required' });
      return;
    }

    // Parse answers if it's a string (from multipart form)
    if (typeof answers === 'string') {
      answers = JSON.parse(answers);
    }

    const files = req.files as Express.Multer.File[] | undefined;

    const result = ticketService.createTicket({
      customerId: customerId!,
      productId: parseInt(productId),
      categoryId: parseInt(categoryId),
      subject,
      description,
      answers: answers || [],
      files,
    });

    // Trigger async AI analysis
    ticketService.updateTicketStatus(result.ticketId, 'analyzing');
    triggerAnalysis(result.ticketId, parseInt(productId), parseInt(categoryId));

    res.status(201).json({
      ticketId: result.ticketId,
      ticketNumber: result.ticketNumber,
      message: 'Ticket created successfully. AI analysis in progress.',
    });
  } catch (error: any) {
    console.error('[Tickets] Create error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

async function triggerAnalysis(ticketId: number, productId: number, categoryId: number) {
  try {
    const analysis = await analyzeTicket(ticketId);

    if (analysis) {
      ticketService.updateAiAnalysis(ticketId, JSON.stringify(analysis), analysis.confidence);

      if (analysis.confidence >= config.autoAssignThreshold) {
        ticketService.assignTicket(ticketId, analysis.recommendedEngineerId);
        console.log(`[AI] Auto-assigned ticket ${ticketId} to engineer ${analysis.recommendedEngineerName} (confidence: ${analysis.confidence})`);
      } else {
        ticketService.updateTicketStatus(ticketId, 'new');
        console.log(`[AI] Ticket ${ticketId} flagged for manual review (confidence: ${analysis.confidence})`);
      }
    } else {
      // Fallback to scoring algorithm
      console.log(`[AI] Claude unavailable, using fallback scoring for ticket ${ticketId}`);
      const best = getBestEngineer(productId, categoryId);
      if (best) {
        const fallbackAnalysis = {
          classification: 'Auto-classified by fallback algorithm',
          severity: 'medium',
          rootCauseHypothesis: 'Requires manual investigation',
          recommendedEngineerId: best.engineerId,
          recommendedEngineerName: best.engineerName,
          confidence: 0.5,
          reasoning: `Fallback algorithm selected based on scoring: ${JSON.stringify(best.breakdown)}`,
          suggestedSkills: [],
          estimatedComplexity: 'medium',
        };
        ticketService.updateAiAnalysis(ticketId, JSON.stringify(fallbackAnalysis), 0.5);
        ticketService.updateTicketStatus(ticketId, 'new'); // Flag for manual review since fallback
      } else {
        ticketService.updateTicketStatus(ticketId, 'new');
      }
    }
  } catch (error) {
    console.error(`[AI] Analysis failed for ticket ${ticketId}:`, error);
    ticketService.updateTicketStatus(ticketId, 'new');
  }
}

export function getTicket(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const ticket = ticketService.getTicketById(parseInt(id));
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Non-admin users can only view their own tickets
  if (req.user?.role !== 'admin' && ticket.customerId !== req.user?.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(ticket);
}

export function trackTicket(req: AuthenticatedRequest, res: Response): void {
  const { ticketNumber } = req.params;
  const ticket = ticketService.getTicketByNumber(ticketNumber);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  // Return limited info for public tracking
  res.json({
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    productName: ticket.product.name,
    categoryName: ticket.category.name,
    engineerName: ticket.assignedEngineer?.name || null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
  });
}

export function listTickets(req: AuthenticatedRequest, res: Response): void {
  const filters: any = {
    status: req.query.status as string,
    priority: req.query.priority as string,
    productId: req.query.productId ? parseInt(req.query.productId as string) : undefined,
    assignedEngineerId: req.query.engineerId ? parseInt(req.query.engineerId as string) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  };

  // Non-admin users can only see their own tickets
  if (req.user?.role !== 'admin') {
    filters.customerId = req.user?.userId;
  }

  const result = ticketService.listTickets(filters);
  res.json(result);
}

export function updateStatus(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  ticketService.updateTicketStatus(parseInt(id), status);
  res.json({ message: 'Status updated' });
}

export function assignEngineer(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const { engineerId } = req.body;

  if (!engineerId) {
    res.status(400).json({ error: 'engineerId is required' });
    return;
  }

  ticketService.assignTicket(parseInt(id), engineerId);
  res.json({ message: 'Engineer assigned' });
}

export function addResponse(req: AuthenticatedRequest, res: Response): void {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const ticket = ticketService.getTicketById(ticketId);

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Check access: admin can respond to any, customer only to own tickets
    if (req.user?.role !== 'admin' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { message, isInternal } = req.body;
    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Look up the user's name from customers table
    const db = getDb();
    const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(req.user!.userId) as any;
    const authorName = customer?.name || 'Unknown';
    const authorRole = req.user!.role;

    // Only admins can create internal notes
    const internal = req.user?.role === 'admin' ? (isInternal || false) : false;

    const responseId = ticketService.addResponse(ticketId, req.user!.userId, authorName, authorRole, message.trim(), internal);

    res.status(201).json({ id: responseId, message: 'Response added' });
  } catch (error: any) {
    console.error('[Tickets] Add response error:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
}

export function getResponses(req: AuthenticatedRequest, res: Response): void {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const ticket = ticketService.getTicketById(ticketId);

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Check access: admin sees all, customer only own tickets
    if (req.user?.role !== 'admin' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const includeInternal = req.user?.role === 'admin';
    const responses = ticketService.getResponses(ticketId, includeInternal);

    res.json(responses);
  } catch (error: any) {
    console.error('[Tickets] Get responses error:', error);
    res.status(500).json({ error: 'Failed to get responses' });
  }
}

export function reanalyzeTicket(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const ticketId = parseInt(id);
  const ticket = ticketService.getTicketById(ticketId);

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticketService.updateTicketStatus(ticketId, 'analyzing');
  triggerAnalysis(ticketId, ticket.productId, ticket.categoryId);

  res.json({ message: 'Re-analysis triggered' });
}
