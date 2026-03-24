import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import * as ticketService from '../services/ticket.service';
import { analyzeTicket, getAutoAssignThreshold } from '../services/claude.service';
import * as claudeSshService from '../services/claude-ssh.service';
import * as claudeWrapperService from '../services/claude-wrapper.service';
import { getSetting } from '../services/settings.service';
import { getBestEngineer } from '../services/assignment.service';
import { config } from '../config';
import * as notificationService from '../services/notification.service';
import * as emailService from '../services/email.service';
import * as webhookService from '../services/webhook.service';
import * as slaService from '../services/sla.service';
import { getDb } from '../db/connection';
import * as activityService from '../services/activity.service';
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

    const { productId, categoryId, subject, description, productKey } = req.body;
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
      productKey: productKey || undefined,
      answers: answers || [],
      files,
    });

    // Trigger async AI analysis
    ticketService.updateTicketStatus(result.ticketId, 'analyzing');
    triggerAnalysis(result.ticketId, parseInt(productId), parseInt(categoryId));

    // Log activity
    const db3 = getDb();
    const custName = db3.prepare('SELECT name FROM customers WHERE id = ?').get(customerId) as any;
    activityService.logActivity(result.ticketId, customerId!, custName?.name || 'Unknown', 'created', 'Ticket created');

    res.status(201).json({
      ticketId: result.ticketId,
      ticketNumber: result.ticketNumber,
      message: 'Ticket created successfully. AI analysis in progress.',
    });

    // Send email notification
    if (req.body.email || req.user?.email) {
      emailService.sendTicketCreatedEmail(
        req.body.email || req.user!.email,
        result.ticketNumber,
        subject
      ).catch(() => {});
    }
    // Webhook notifications
    const db2 = getDb();
    const cust = db2.prepare('SELECT name FROM customers WHERE id = ?').get(customerId) as any;
    const prod = db2.prepare('SELECT name FROM products WHERE id = ?').get(parseInt(productId)) as any;
    webhookService.notifyNewTicket(result.ticketNumber, prod?.name || productId, subject, cust?.name || 'Unknown');
  } catch (error: any) {
    console.error('[Tickets] Create error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

async function triggerAnalysis(ticketId: number, productId: number, categoryId: number) {
  try {
    const analysisMode = getSetting('claude_analysis_mode') || 'ssh';

    // Wrapper mode: HTTP → Claude Code CLI with full server access (recommended)
    if (analysisMode === 'wrapper') {
      await triggerWrapperAnalysis(ticketId, productId, categoryId);
      return;
    }

    // SSH mode: SFTP files + Claude CLI
    if (analysisMode === 'ssh') {
      await triggerSshAnalysis(ticketId);
      return;
    }

    // API mode: HTTP API call (original flow)
    const analysis = await analyzeTicket(ticketId);

    if (analysis) {
      ticketService.updateAiAnalysis(ticketId, JSON.stringify(analysis), analysis.confidence);

      if (analysis.confidence >= getAutoAssignThreshold()) {
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

async function triggerSshAnalysis(ticketId: number) {
  const db = getDb();
  const ticket = ticketService.getTicketById(ticketId);
  if (!ticket) return;

  // Gather engineer info
  const engineers = db.prepare('SELECT * FROM engineers WHERE is_active = 1 AND current_workload < max_workload').all() as any[];
  const engineerList = engineers.map((e: any) => {
    const skills = db.prepare('SELECT s.name, es.proficiency FROM engineer_skills es JOIN skills s ON es.skill_id = s.id WHERE es.engineer_id = ?').all(e.id) as any[];
    const expertise = db.prepare('SELECT p.name as pname, COALESCE(pc.name, \'General\') as cname, epe.expertise_level FROM engineer_product_expertise epe JOIN products p ON epe.product_id = p.id LEFT JOIN product_categories pc ON epe.category_id = pc.id WHERE epe.engineer_id = ?').all(e.id) as any[];
    return {
      id: e.id,
      name: e.name,
      skills: skills.map((s: any) => `${s.name}(${s.proficiency}/5)`).join(', '),
      expertise: expertise.map((ex: any) => `${ex.pname}/${ex.cname}(${ex.expertise_level}/5)`).join(', '),
      workload: `${e.current_workload}/${e.max_workload}`,
    };
  });

  // Gather attachments with local paths
  const attachments = db.prepare('SELECT * FROM ticket_attachments WHERE ticket_id = ?').all(ticketId) as any[];

  try {
    const result = await claudeSshService.analyzeTicketViaSsh({
      ticketNumber: ticket.ticketNumber,
      productName: ticket.product.name,
      productModel: ticket.product.model,
      categoryName: ticket.category.name,
      subject: ticket.subject,
      description: ticket.description,
      productKey: ticket.productKey,
      answers: ticket.answers.map((a: any) => ({ question: a.question_text, answer: a.answer })),
      attachments: attachments.map((a: any) => ({
        localPath: a.path,
        filename: a.filename,
        originalName: a.original_name,
      })),
      engineers: engineerList,
    });

    if (result.success && result.report) {
      // Save full report
      const fullReport = result.report;

      // Try to extract JSON from report
      const jsonMatch = fullReport.match(/```json\s*([\s\S]*?)```/) || fullReport.match(/\{[\s\S]*"classification"[\s\S]*\}/);
      let analysisJson: any = null;

      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          analysisJson = JSON.parse(jsonStr.trim());
        } catch { /* JSON parse failed, use report as-is */ }
      }

      if (analysisJson) {
        // Structured analysis found
        const analysis = {
          ...analysisJson,
          fullReport: fullReport, // Include full Claude report
        };
        const confidence = analysisJson.confidence || 0.5;
        ticketService.updateAiAnalysis(ticketId, JSON.stringify(analysis), confidence);

        if (confidence >= getAutoAssignThreshold() && analysisJson.recommendedEngineerId) {
          ticketService.assignTicket(ticketId, analysisJson.recommendedEngineerId);
          console.log(`[SSH-AI] Auto-assigned ticket ${ticketId} to ${analysisJson.recommendedEngineerName} (confidence: ${confidence})`);
        } else {
          ticketService.updateTicketStatus(ticketId, 'new');
          console.log(`[SSH-AI] Ticket ${ticketId} flagged for manual review (confidence: ${confidence})`);
        }
      } else {
        // No structured JSON, save full report as analysis
        const fallback = {
          classification: 'Analyzed by Claude Code (see full report)',
          severity: 'medium',
          rootCauseHypothesis: 'See full report below',
          fullReport: fullReport,
          confidence: 0.5,
        };
        ticketService.updateAiAnalysis(ticketId, JSON.stringify(fallback), 0.5);
        ticketService.updateTicketStatus(ticketId, 'new');
      }

      // Log activity
      activityService.logActivity(ticketId, null, 'Claude AI', 'ai_analysis', 'AI analysis completed via SSH');
    } else {
      console.error(`[SSH-AI] Analysis failed for ticket ${ticketId}: ${result.error}`);
      // Fallback to scoring
      const best = getBestEngineer(ticket.productId, ticket.categoryId);
      if (best) {
        ticketService.updateAiAnalysis(ticketId, JSON.stringify({
          classification: 'SSH analysis failed, using fallback',
          severity: 'medium',
          rootCauseHypothesis: 'Manual investigation needed',
          recommendedEngineerId: best.engineerId,
          recommendedEngineerName: best.engineerName,
          confidence: 0.3,
          reasoning: `SSH analysis failed: ${result.error}. Fallback scoring used.`,
          suggestedSkills: [],
          estimatedComplexity: 'medium',
        }), 0.3);
      }
      ticketService.updateTicketStatus(ticketId, 'new');
    }
  } catch (error: any) {
    console.error(`[SSH-AI] Error for ticket ${ticketId}:`, error);
    ticketService.updateTicketStatus(ticketId, 'new');
  }
}

async function triggerWrapperAnalysis(ticketId: number, productId: number, categoryId: number) {
  const db = getDb();
  const ticket = ticketService.getTicketById(ticketId);
  if (!ticket) return;

  // Gather engineer info
  const engineers = db.prepare('SELECT * FROM engineers WHERE is_active = 1 AND current_workload < max_workload').all() as any[];
  const engineerList = engineers.map((e: any) => {
    const skills = db.prepare('SELECT s.name, es.proficiency FROM engineer_skills es JOIN skills s ON es.skill_id = s.id WHERE es.engineer_id = ?').all(e.id) as any[];
    const expertise = db.prepare('SELECT p.name as pname, COALESCE(pc.name, \'General\') as cname, epe.expertise_level FROM engineer_product_expertise epe JOIN products p ON epe.product_id = p.id LEFT JOIN product_categories pc ON epe.category_id = pc.id WHERE epe.engineer_id = ?').all(e.id) as any[];
    return {
      id: e.id,
      name: e.name,
      skills: skills.map((s: any) => `${s.name}(${s.proficiency}/5)`).join(', '),
      expertise: expertise.map((ex: any) => `${ex.pname}/${ex.cname}(${ex.expertise_level}/5)`).join(', '),
      workload: `${e.current_workload}/${e.max_workload}`,
    };
  });

  // Gather attachments
  const attachments = db.prepare('SELECT * FROM ticket_attachments WHERE ticket_id = ?').all(ticketId) as any[];

  try {
    const result = await claudeWrapperService.analyzeTicketViaWrapper({
      ticketNumber: ticket.ticketNumber,
      productName: ticket.product.name,
      productModel: ticket.product.model,
      categoryName: ticket.category.name,
      subject: ticket.subject,
      description: ticket.description,
      productKey: ticket.productKey,
      answers: ticket.answers.map((a: any) => ({ question: a.question_text, answer: a.answer })),
      attachments: attachments.map((a: any) => ({
        localPath: a.path,
        filename: a.filename,
        originalName: a.original_name,
      })),
      engineers: engineerList,
    });

    if (result.success && result.analysis) {
      const analysis = {
        ...result.analysis,
        fullReport: result.rawOutput,
        analysisMode: 'wrapper',
        executionTimeSeconds: result.executionTimeSeconds,
      };
      const confidence = result.analysis.confidence || 0.5;
      ticketService.updateAiAnalysis(ticketId, JSON.stringify(analysis), confidence);

      if (confidence >= getAutoAssignThreshold() && result.analysis.recommendedEngineerId) {
        ticketService.assignTicket(ticketId, result.analysis.recommendedEngineerId);
        console.log(`[Wrapper-AI] Auto-assigned ticket ${ticketId} to ${result.analysis.recommendedEngineerName} (confidence: ${confidence})`);
      } else {
        ticketService.updateTicketStatus(ticketId, 'new');
        console.log(`[Wrapper-AI] Ticket ${ticketId} flagged for manual review (confidence: ${confidence})`);
      }

      activityService.logActivity(ticketId, null, 'Claude AI', 'ai_analysis', `AI analysis completed via wrapper service (${result.executionTimeSeconds}s)`);
    } else if (result.success && result.rawOutput) {
      // Got raw output but no structured analysis
      const fallback = {
        classification: 'Analyzed by Claude Code Wrapper (see full report)',
        severity: 'medium',
        rootCauseHypothesis: 'See full report below',
        fullReport: result.rawOutput,
        confidence: 0.5,
        analysisMode: 'wrapper',
      };
      ticketService.updateAiAnalysis(ticketId, JSON.stringify(fallback), 0.5);
      ticketService.updateTicketStatus(ticketId, 'new');
      activityService.logActivity(ticketId, null, 'Claude AI', 'ai_analysis', 'AI analysis completed (unstructured report)');
    } else {
      // Wrapper failed, fallback to scoring
      console.error(`[Wrapper-AI] Analysis failed for ticket ${ticketId}: ${result.error}`);
      const best = getBestEngineer(productId, categoryId);
      if (best) {
        ticketService.updateAiAnalysis(ticketId, JSON.stringify({
          classification: 'Wrapper analysis failed, using fallback',
          severity: 'medium',
          rootCauseHypothesis: 'Manual investigation needed',
          recommendedEngineerId: best.engineerId,
          recommendedEngineerName: best.engineerName,
          confidence: 0.3,
          reasoning: `Wrapper analysis failed: ${result.error}. Fallback scoring used.`,
          suggestedSkills: [],
          estimatedComplexity: 'medium',
        }), 0.3);
      }
      ticketService.updateTicketStatus(ticketId, 'new');
    }

    // Optionally cleanup files on the wrapper server
    claudeWrapperService.cleanupWrapperFiles(ticket.ticketNumber).catch(() => {});
  } catch (error: any) {
    console.error(`[Wrapper-AI] Error for ticket ${ticketId}:`, error);
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

  const slaStatus = slaService.getTicketSlaStatus(parseInt(id));
  res.json({ ...ticket, slaStatus });
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
    search: req.query.search as string || undefined,
    fromDate: req.query.fromDate as string || undefined,
    toDate: req.query.toDate as string || undefined,
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

  // Log activity
  const dbStatus = getDb();
  const userForStatus = dbStatus.prepare('SELECT name FROM customers WHERE id = ?').get(req.user!.userId) as any;
  activityService.logActivity(parseInt(id), req.user!.userId, userForStatus?.name || 'Unknown', 'status_changed', `Status changed to ${status}`);

  const ticket = ticketService.getTicketById(parseInt(id));
  if (ticket) {
    const statusLabels: Record<string, string> = {
      assigned: 'Your ticket has been assigned to an engineer',
      in_progress: 'An engineer is working on your ticket',
      pending_info: 'More information is needed for your ticket',
      resolved: 'Your ticket has been resolved',
      closed: 'Your ticket has been closed',
    };
    if (statusLabels[status]) {
      notificationService.createNotification(
        ticket.customerId, parseInt(id),
        status === 'resolved' ? 'resolved' : 'status_change',
        statusLabels[status],
        `Ticket ${ticket.ticketNumber} status changed to "${status.replace('_', ' ')}"`
      );
      emailService.sendTicketStatusEmail(ticket.customer.email, ticket.ticketNumber, status).catch(() => {});
    }
    if (status === 'resolved') {
      notificationService.createNotification(
        ticket.customerId, parseInt(id), 'resolved',
        'Please rate your support experience',
        `Ticket ${ticket.ticketNumber} has been resolved. We'd love your feedback!`
      );
    }
  }

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

  // Log activity
  const dbAssign = getDb();
  const userForAssign = dbAssign.prepare('SELECT name FROM customers WHERE id = ?').get(req.user!.userId) as any;
  activityService.logActivity(parseInt(id), req.user!.userId, userForAssign?.name || 'Unknown', 'assigned', `Assigned to engineer #${engineerId}`);

  const ticket = ticketService.getTicketById(parseInt(id));
  if (ticket) {
    const engineer = ticket.assignedEngineer;
    notificationService.createNotification(
      ticket.customerId, parseInt(id), 'assigned',
      'Engineer assigned to your ticket',
      `${engineer?.name || 'An engineer'} has been assigned to ticket ${ticket.ticketNumber}`
    );
  }

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

    // Log activity
    activityService.logActivity(ticketId, req.user!.userId, authorName, internal ? 'internal_note' : 'response', 'Added response');

    if (authorRole === 'admin' && !internal) {
      notificationService.createNotification(
        ticket.customerId, ticketId, 'response',
        'New response on your ticket',
        `An engineer responded to ticket ${ticket.ticketNumber}`
      );
      emailService.sendTicketResponseEmail(
        ticket.customer.email, ticket.ticketNumber, authorName, message.trim()
      ).catch(() => {});
    }

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

export function deleteTicket(req: AuthenticatedRequest, res: Response): void {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const db = getDb();

    db.transaction(() => {
      db.prepare('DELETE FROM ticket_responses WHERE ticket_id = ?').run(ticketId);
      db.prepare('DELETE FROM ticket_attachments WHERE ticket_id = ?').run(ticketId);
      db.prepare('DELETE FROM ticket_answers WHERE ticket_id = ?').run(ticketId);
      db.prepare('DELETE FROM notifications WHERE ticket_id = ?').run(ticketId);
      // Decrement engineer workload if assigned
      const ticket = db.prepare('SELECT assigned_engineer_id FROM tickets WHERE id = ?').get(ticketId) as any;
      if (ticket?.assigned_engineer_id) {
        db.prepare('UPDATE engineers SET current_workload = MAX(0, current_workload - 1) WHERE id = ?').run(ticket.assigned_engineer_id);
      }
      db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);
    })();

    res.json({ message: 'Ticket deleted' });
  } catch (error: any) {
    console.error('[Tickets] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
}

export function updatePriority(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const { priority } = req.body;
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (!validPriorities.includes(priority)) {
    res.status(400).json({ error: 'Invalid priority' });
    return;
  }
  const db = getDb();
  db.prepare("UPDATE tickets SET priority = ?, updated_at = datetime('now') WHERE id = ?").run(priority, id);

  // Log activity
  const userForPriority = db.prepare('SELECT name FROM customers WHERE id = ?').get(req.user!.userId) as any;
  activityService.logActivity(parseInt(id), req.user!.userId, userForPriority?.name || 'Unknown', 'priority_changed', `Priority changed to ${priority}`);

  res.json({ message: 'Priority updated' });
}

export function bulkUpdateStatus(req: AuthenticatedRequest, res: Response): void {
  const { ticketIds, status } = req.body;
  if (!Array.isArray(ticketIds) || !status) {
    res.status(400).json({ error: 'ticketIds array and status are required' });
    return;
  }
  const db = getDb();
  const stmt = db.prepare("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?");
  db.transaction(() => {
    for (const id of ticketIds) stmt.run(status, id);
  })();
  res.json({ message: `${ticketIds.length} tickets updated` });
}

export function bulkAssign(req: AuthenticatedRequest, res: Response): void {
  const { ticketIds, engineerId } = req.body;
  if (!Array.isArray(ticketIds) || !engineerId) {
    res.status(400).json({ error: 'ticketIds array and engineerId are required' });
    return;
  }
  const db = getDb();
  db.transaction(() => {
    for (const id of ticketIds) {
      const ticket = db.prepare('SELECT assigned_engineer_id FROM tickets WHERE id = ?').get(id) as any;
      if (ticket?.assigned_engineer_id) {
        db.prepare('UPDATE engineers SET current_workload = MAX(0, current_workload - 1) WHERE id = ?').run(ticket.assigned_engineer_id);
      }
      db.prepare("UPDATE tickets SET assigned_engineer_id = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?").run(engineerId, id);
    }
    db.prepare("UPDATE engineers SET current_workload = current_workload + ?, updated_at = datetime('now') WHERE id = ?").run(ticketIds.length, engineerId);
  })();
  res.json({ message: `${ticketIds.length} tickets assigned` });
}

export function bulkDelete(req: AuthenticatedRequest, res: Response): void {
  const { ticketIds } = req.body;
  if (!Array.isArray(ticketIds)) {
    res.status(400).json({ error: 'ticketIds array is required' });
    return;
  }
  const db = getDb();
  db.transaction(() => {
    for (const id of ticketIds) {
      const ticket = db.prepare('SELECT assigned_engineer_id FROM tickets WHERE id = ?').get(id) as any;
      if (ticket?.assigned_engineer_id) {
        db.prepare('UPDATE engineers SET current_workload = MAX(0, current_workload - 1) WHERE id = ?').run(ticket.assigned_engineer_id);
      }
      db.prepare('DELETE FROM ticket_responses WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM ticket_attachments WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM ticket_answers WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM notifications WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    }
  })();
  res.json({ message: `${ticketIds.length} tickets deleted` });
}

export function getActivities(req: AuthenticatedRequest, res: Response): void {
  const { id } = req.params;
  const activities = activityService.getActivities(parseInt(id));
  res.json(activities);
}

export function addTag(req: AuthenticatedRequest, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { tag } = req.body;
  if (!tag?.trim()) { res.status(400).json({ error: 'tag is required' }); return; }
  try {
    db.prepare('INSERT OR IGNORE INTO ticket_tags (ticket_id, tag) VALUES (?, ?)').run(id, tag.trim().toLowerCase());
    res.json({ message: 'Tag added' });
  } catch { res.status(500).json({ error: 'Failed to add tag' }); }
}

export function removeTag(req: AuthenticatedRequest, res: Response): void {
  const db = getDb();
  const { id, tag } = req.params;
  db.prepare('DELETE FROM ticket_tags WHERE ticket_id = ? AND tag = ?').run(id, tag);
  res.json({ message: 'Tag removed' });
}

export function getTags(req: AuthenticatedRequest, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const tags = db.prepare('SELECT tag FROM ticket_tags WHERE ticket_id = ?').all(id);
  res.json(tags.map((t: any) => t.tag));
}

export function submitSatisfaction(req: AuthenticatedRequest, res: Response): void {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const { rating, comment } = req.body;
    const db = getDb();

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5' });
      return;
    }

    const ticket = ticketService.getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Check ticket belongs to customer (or user is admin)
    if (req.user?.role !== 'admin' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check ticket status is resolved or closed
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      res.status(400).json({ error: 'Ticket must be resolved or closed to submit a rating' });
      return;
    }

    // Insert (UNIQUE constraint will prevent duplicates)
    try {
      db.prepare(
        'INSERT INTO ticket_satisfaction (ticket_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)'
      ).run(ticketId, ticket.customerId, rating, comment || null);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        res.status(409).json({ error: 'Satisfaction rating already submitted for this ticket' });
        return;
      }
      throw err;
    }

    // Log activity
    const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(req.user!.userId) as any;
    activityService.logActivity(ticketId, req.user!.userId, customer?.name || 'Unknown', 'satisfaction_rated', `Rated ${rating}/5`);

    res.status(201).json({ message: 'Satisfaction rating submitted' });
  } catch (error: any) {
    console.error('[Tickets] Submit satisfaction error:', error);
    res.status(500).json({ error: 'Failed to submit satisfaction rating' });
  }
}

export function getSatisfaction(req: AuthenticatedRequest, res: Response): void {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const db = getDb();

    const ticket = ticketService.getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (req.user?.role !== 'admin' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const satisfaction = db.prepare(
      'SELECT rating, comment, created_at as createdAt FROM ticket_satisfaction WHERE ticket_id = ?'
    ).get(ticketId) as any;

    res.json(satisfaction || null);
  } catch (error: any) {
    console.error('[Tickets] Get satisfaction error:', error);
    res.status(500).json({ error: 'Failed to get satisfaction rating' });
  }
}
