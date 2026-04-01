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
import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';
import * as activityService from '../services/activity.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function createTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    let customerId = req.user?.userId;

    // Handle anonymous/unauthenticated submission
    if (!customerId) {
      const { email, name } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email is required for anonymous submissions' });
        return;
      }
      let customer = await queryOne<any>('SELECT id FROM customers WHERE email = ?', [email]);
      if (!customer) {
        const result = await query(
          'INSERT INTO customers (email, name, is_anonymous) VALUES (?, ?, TRUE) RETURNING id',
          [email, name || 'Anonymous']
        );
        customerId = result.rows[0].id;
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

    const result = await ticketService.createTicket({
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
    await ticketService.updateTicketStatus(result.ticketId, 'analyzing');
    triggerAnalysis(result.ticketId, parseInt(productId), parseInt(categoryId));

    // Log activity
    const custName = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [customerId]);
    await activityService.logActivity(result.ticketId, customerId!, custName?.name || 'Unknown', 'created', 'Ticket created');

    // Auto-detect missing required info and add auto-response
    checkMissingInfo(result.ticketId, parseInt(productId), productKey, files);

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
    const cust = await queryOne<any>('SELECT name, company FROM customers WHERE id = ?', [customerId]);
    const prod = await queryOne<any>('SELECT name FROM products WHERE id = ?', [parseInt(productId)]);
    const customerLabel = cust?.company ? `${cust.name} (${cust.company})` : (cust?.name || 'Unknown');
    webhookService.notifyNewTicket(result.ticketNumber, prod?.name || productId, subject, customerLabel);
  } catch (error: any) {
    console.error('[Tickets] Create error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

async function checkMissingInfo(ticketId: number, productId: number, productKey: string | undefined, files: Express.Multer.File[] | undefined) {
  try {
    const product = await queryOne<any>('SELECT name FROM products WHERE id = ?', [productId]);
    if (!product) return;

    const productName = (product.name || '').toLowerCase();
    const missingItems: string[] = [];

    // Check if product key / serial number is missing for known products
    const needsKey = productName.includes('prosbc') || productName.includes('tmg') || productName.includes('tsg');
    if (needsKey && (!productKey || !productKey.trim())) {
      if (productName.includes('prosbc')) {
        missingItems.push('- **Product Key**: Please provide your ProSBC product key (format: VTB-XXXX-XXXX). You can find it under System > License in the ProSBC web interface.');
      } else {
        missingItems.push('- **Serial Number**: Please provide your unit serial number (format: TB0XXXXX). It is printed on the label on the back/bottom of your unit.');
      }
    }

    // Check if log files are missing
    const hasLogFiles = files && files.length > 0 && files.some(f => {
      const ext = f.originalname.toLowerCase();
      return ext.endsWith('.log') || ext.endsWith('.pcap') || ext.endsWith('.pcapng') || ext.endsWith('.gz') || ext.endsWith('.tgz') || ext.endsWith('.zip') || ext.endsWith('.tar') || ext.endsWith('.7z');
    });

    if (!files || files.length === 0) {
      missingItems.push('- **Log files**: No files were attached. Please upload relevant log files (tbreport, pcap captures, screenshots) to help us diagnose the issue faster.');
    } else if (!hasLogFiles) {
      missingItems.push('- **Diagnostic logs**: No log/capture files detected. If possible, please attach a tbreport output or pcap capture related to the issue.');
    }

    if (missingItems.length > 0) {
      const autoMessage = `Thank you for submitting your ticket. To help us resolve your issue as quickly as possible, we noticed the following information is missing:\n\n${missingItems.join('\n\n')}\n\nPlease reply to this ticket with the missing information, or use the "Add Files" button to upload log files.`;

      // Add as a public auto-response from system
      await ticketService.addResponse(ticketId, 0, 'Support System', 'admin', autoMessage, false);

      // Also add internal note for engineers
      await ticketService.addResponse(ticketId, 0, 'System', 'admin',
        `[Auto-detection] Missing info detected: ${missingItems.length === 1 ? '1 item' : missingItems.length + ' items'}. Auto-reply sent to customer.`,
        true
      );

      await activityService.logActivity(ticketId, null, 'System', 'auto_response', 'Auto-reply sent for missing required information');
    }
  } catch (error) {
    console.error('[Auto-detect] Failed to check missing info:', error);
  }
}

async function sendAutoAssignEmail(ticketId: number, engineerId: number) {
  try {
    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) return;
    const engineer = await queryOne<any>('SELECT name, email FROM engineers WHERE id = ?', [engineerId]);
    if (!engineer?.email) return;
    const slaPolicy = await slaService.getSlaPolicy(ticket.priority);
    emailService.sendEngineerAssignedEmail(
      engineer.email,
      engineer.name,
      ticket.ticketNumber,
      ticket.subject,
      ticket.customer.name,
      ticket.customer.company,
      ticket.createdAt,
      ticket.priority,
      !!ticket.aiAnalysis,
      slaPolicy?.response_time_hours ?? null,
      slaPolicy?.resolution_time_hours ?? null,
    );
  } catch (err) {
    console.error(`[Email] Failed to send engineer assignment email for ticket ${ticketId}:`, err);
  }
}

async function triggerAnalysis(ticketId: number, productId: number, categoryId: number, customPrompt?: string) {
  try {
    const analysisMode = await getSetting('claude_analysis_mode') || 'ssh';

    // Wrapper mode: HTTP -> Claude Code CLI with full server access (recommended)
    if (analysisMode === 'wrapper') {
      await triggerWrapperAnalysis(ticketId, productId, categoryId, customPrompt);
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
      await ticketService.updateAiAnalysis(ticketId, JSON.stringify(analysis), analysis.confidence);

      if (analysis.confidence >= await getAutoAssignThreshold()) {
        await ticketService.assignTicket(ticketId, analysis.recommendedEngineerId);
        console.log(`[AI] Auto-assigned ticket ${ticketId} to engineer ${analysis.recommendedEngineerName} (confidence: ${analysis.confidence})`);
        sendAutoAssignEmail(ticketId, analysis.recommendedEngineerId);
      } else {
        await ticketService.updateTicketStatus(ticketId, 'new');
        console.log(`[AI] Ticket ${ticketId} flagged for manual review (confidence: ${analysis.confidence})`);
      }
    } else {
      // Fallback to scoring algorithm
      console.log(`[AI] Claude unavailable, using fallback scoring for ticket ${ticketId}`);
      const best = await getBestEngineer(productId, categoryId);
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
        await ticketService.updateAiAnalysis(ticketId, JSON.stringify(fallbackAnalysis), 0.5);
        await ticketService.updateTicketStatus(ticketId, 'new'); // Flag for manual review since fallback
      } else {
        await ticketService.updateTicketStatus(ticketId, 'new');
      }
    }
  } catch (error) {
    console.error(`[AI] Analysis failed for ticket ${ticketId}:`, error);
    await ticketService.updateTicketStatus(ticketId, 'new');
  }
}

async function triggerSshAnalysis(ticketId: number) {
  const ticket = await ticketService.getTicketById(ticketId);
  if (!ticket) return;

  // Gather engineer info
  const engineers = await queryAll<any>('SELECT * FROM engineers WHERE is_active = TRUE AND current_workload < max_workload');
  const engineerList = [];
  for (const e of engineers) {
    const skills = await queryAll<any>('SELECT s.name, es.proficiency FROM engineer_skills es JOIN skills s ON es.skill_id = s.id WHERE es.engineer_id = ?', [e.id]);
    const expertise = await queryAll<any>('SELECT p.name as pname, COALESCE(pc.name, \'General\') as cname, epe.expertise_level FROM engineer_product_expertise epe JOIN products p ON epe.product_id = p.id LEFT JOIN product_categories pc ON epe.category_id = pc.id WHERE epe.engineer_id = ?', [e.id]);
    engineerList.push({
      id: e.id,
      name: e.name,
      skills: skills.map((s: any) => `${s.name}(${s.proficiency}/5)`).join(', '),
      expertise: expertise.map((ex: any) => `${ex.pname}/${ex.cname}(${ex.expertise_level}/5)`).join(', '),
      workload: `${e.current_workload}/${e.max_workload}`,
    });
  }

  // Gather attachments with local paths
  const attachments = await queryAll<any>('SELECT * FROM ticket_attachments WHERE ticket_id = ?', [ticketId]);

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
        await ticketService.updateAiAnalysis(ticketId, JSON.stringify(analysis), confidence);

        if (confidence >= await getAutoAssignThreshold() && analysisJson.recommendedEngineerId) {
          await ticketService.assignTicket(ticketId, analysisJson.recommendedEngineerId);
          console.log(`[SSH-AI] Auto-assigned ticket ${ticketId} to ${analysisJson.recommendedEngineerName} (confidence: ${confidence})`);
          sendAutoAssignEmail(ticketId, analysisJson.recommendedEngineerId);
        } else {
          await ticketService.updateTicketStatus(ticketId, 'new');
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
        await ticketService.updateAiAnalysis(ticketId, JSON.stringify(fallback), 0.5);
        await ticketService.updateTicketStatus(ticketId, 'new');
      }

      // Log activity
      await activityService.logActivity(ticketId, null, 'Claude AI', 'ai_analysis', 'AI analysis completed via SSH');
    } else {
      console.error(`[SSH-AI] Analysis failed for ticket ${ticketId}: ${result.error}`);
      // Fallback to scoring
      const best = await getBestEngineer(ticket.productId, ticket.categoryId);
      if (best) {
        await ticketService.updateAiAnalysis(ticketId, JSON.stringify({
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
      await ticketService.updateTicketStatus(ticketId, 'new');
    }
  } catch (error: any) {
    console.error(`[SSH-AI] Error for ticket ${ticketId}:`, error);
    await ticketService.updateTicketStatus(ticketId, 'new');
  }
}

async function triggerWrapperAnalysis(ticketId: number, productId: number, categoryId: number, customPrompt?: string) {
  const ticket = await ticketService.getTicketById(ticketId);
  if (!ticket) return;

  // Gather engineer info
  const engineers = await queryAll<any>('SELECT * FROM engineers WHERE is_active = TRUE AND current_workload < max_workload');
  const engineerList = [];
  for (const e of engineers) {
    const skills = await queryAll<any>('SELECT s.name, es.proficiency FROM engineer_skills es JOIN skills s ON es.skill_id = s.id WHERE es.engineer_id = ?', [e.id]);
    const expertise = await queryAll<any>('SELECT p.name as pname, COALESCE(pc.name, \'General\') as cname, epe.expertise_level FROM engineer_product_expertise epe JOIN products p ON epe.product_id = p.id LEFT JOIN product_categories pc ON epe.category_id = pc.id WHERE epe.engineer_id = ?', [e.id]);
    engineerList.push({
      id: e.id,
      name: e.name,
      skills: skills.map((s: any) => `${s.name}(${s.proficiency}/5)`).join(', '),
      expertise: expertise.map((ex: any) => `${ex.pname}/${ex.cname}(${ex.expertise_level}/5)`).join(', '),
      workload: `${e.current_workload}/${e.max_workload}`,
    });
  }

  // Gather attachments
  const attachments = await queryAll<any>('SELECT * FROM ticket_attachments WHERE ticket_id = ?', [ticketId]);

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
      customPrompt,
    });

    if (result.success && result.analysis) {
      const analysis = {
        ...result.analysis,
        fullReport: result.analysis.fullReport || result.rawOutput,
        analysisMode: 'wrapper',
        executionTimeSeconds: result.executionTimeSeconds,
      };
      const confidence = result.analysis.confidence || 0.5;
      const engineerId = result.analysis.recommendedEngineerId;
      const threshold = await getAutoAssignThreshold();
      await ticketService.updateAiAnalysis(ticketId, JSON.stringify(analysis), confidence);

      console.log(`[Wrapper-AI] Ticket ${ticketId}: confidence=${confidence}, threshold=${threshold}, engineerId=${engineerId} (type: ${typeof engineerId})`);

      if (confidence >= threshold && engineerId) {
        const numericEngineerId = typeof engineerId === 'string' ? parseInt(engineerId, 10) : engineerId;
        await ticketService.assignTicket(ticketId, numericEngineerId);
        console.log(`[Wrapper-AI] Auto-assigned ticket ${ticketId} to ${result.analysis.recommendedEngineerName} (confidence: ${confidence})`);
        sendAutoAssignEmail(ticketId, numericEngineerId);
      } else {
        await ticketService.updateTicketStatus(ticketId, 'new');
        console.log(`[Wrapper-AI] Ticket ${ticketId} flagged for manual review (confidence: ${confidence}, threshold: ${threshold}, engineerId: ${engineerId})`);
      }

      await activityService.logActivity(ticketId, null, 'Claude AI', 'ai_analysis', `AI analysis completed via wrapper service (${result.executionTimeSeconds}s)`);

      // Teams/Slack webhook for AI analysis completion
      webhookService.notifyAiAnalysisComplete(
        ticket.ticketNumber,
        result.analysis.classification || 'N/A',
        confidence,
        result.analysis.recommendedEngineerName || '',
      );
    } else if (result.success && result.rawOutput) {
      // Got raw output but no structured analysis — try to extract readable text from CLI JSON
      let reportText = result.rawOutput;
      try {
        const parsed = JSON.parse(result.rawOutput);
        if (parsed.result) reportText = parsed.result;
      } catch { /* not JSON, use as-is */ }
      const fallback = {
        classification: 'Analyzed by Claude Code Wrapper (see full report)',
        severity: 'medium',
        rootCauseHypothesis: 'See full report below',
        fullReport: reportText,
        confidence: 0.5,
        analysisMode: 'wrapper',
      };
      await ticketService.updateAiAnalysis(ticketId, JSON.stringify(fallback), 0.5);
      await ticketService.updateTicketStatus(ticketId, 'new');
      await activityService.logActivity(ticketId, null, 'Claude AI', 'ai_analysis', 'AI analysis completed (unstructured report)');
    } else {
      // Wrapper failed, fallback to scoring
      console.error(`[Wrapper-AI] Analysis failed for ticket ${ticketId}: ${result.error}`);
      const best = await getBestEngineer(productId, categoryId);
      if (best) {
        await ticketService.updateAiAnalysis(ticketId, JSON.stringify({
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
      await ticketService.updateTicketStatus(ticketId, 'new');
    }

    // Optionally cleanup files on the wrapper server
    claudeWrapperService.cleanupWrapperFiles(ticket.ticketNumber).catch(() => {});
  } catch (error: any) {
    console.error(`[Wrapper-AI] Error for ticket ${ticketId}:`, error);
    await ticketService.updateTicketStatus(ticketId, 'new');
  }
}

export async function getTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  // Support both numeric ID and ticket number (TKT-xxx)
  let ticket;
  if (/^\d+$/.test(id)) {
    ticket = await ticketService.getTicketById(parseInt(id));
  } else {
    ticket = await ticketService.getTicketByNumber(id);
  }

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Non-admin users can only view their own tickets
  if (req.user?.role !== 'admin' && req.user?.role !== 'engineer' && ticket.customerId !== req.user?.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const slaStatus = await slaService.getTicketSlaStatus(ticket.id);
  res.json({ ...ticket, slaStatus });
}

export async function trackTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ticketNumber } = req.params;
  const ticket = await ticketService.getTicketByNumber(ticketNumber);
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

export async function listTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  const filters: any = {
    status: req.query.status as string || undefined,
    excludeStatus: req.query.excludeStatus as string || undefined,
    priority: req.query.priority as string || undefined,
    productId: req.query.productId ? parseInt(req.query.productId as string) : undefined,
    assignedEngineerId: req.query.engineerId ? parseInt(req.query.engineerId as string) : undefined,
    customerSearch: req.query.customerSearch as string || undefined,
    tag: req.query.tag as string || undefined,
    search: req.query.search as string || undefined,
    fromDate: req.query.fromDate as string || undefined,
    toDate: req.query.toDate as string || undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  };

  // Non-admin users can only see their own tickets (or company tickets if enabled)
  if (req.user?.role !== 'admin' && req.user?.role !== 'engineer') {
    filters.customerId = req.user?.userId;
    // Check if user has company-wide visibility enabled
    const customer = await queryOne<any>('SELECT company_ticket_visibility, company FROM customers WHERE id = ?', [req.user?.userId]);
    if (customer?.company_ticket_visibility && customer?.company) {
      filters.includeCompanyTickets = true;
    }
  }

  const result = await ticketService.listTickets(filters);
  res.json(result);
}

export async function updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'analyzing', 'assigned', 'in_progress', 'pending_info', 'escalated_to_jira', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  // Capture old status before updating
  const oldTicket = await ticketService.getTicketById(parseInt(id));
  const oldStatus = oldTicket?.status || 'unknown';

  await ticketService.updateTicketStatus(parseInt(id), status);

  // Log activity
  const userForStatus = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [req.user!.userId]);
  await activityService.logActivity(parseInt(id), req.user!.userId, userForStatus?.name || 'Unknown', 'status_changed', `Status changed to ${status}`);

  // Teams/Slack webhook for status change
  webhookService.notifyTicketStatusChanged(
    oldTicket?.ticketNumber || id, oldStatus, status, userForStatus?.name || 'Unknown'
  );

  const ticket = await ticketService.getTicketById(parseInt(id));
  if (ticket) {
    const statusLabels: Record<string, string> = {
      assigned: 'Your ticket has been assigned to an engineer',
      in_progress: 'An engineer is working on your ticket',
      pending_info: 'More information is needed for your ticket',
      resolved: 'Your ticket has been resolved',
      closed: 'Your ticket has been closed',
    };
    if (statusLabels[status]) {
      await notificationService.createNotification(
        ticket.customerId, parseInt(id),
        status === 'resolved' ? 'resolved' : 'status_change',
        statusLabels[status],
        `Ticket ${ticket.ticketNumber} status changed to "${status.replace('_', ' ')}"`
      );
      emailService.sendTicketStatusEmail(ticket.customer.email, ticket.ticketNumber, status, ticket.id).catch(() => {});
    }
    if (status === 'resolved') {
      await notificationService.createNotification(
        ticket.customerId, parseInt(id), 'resolved',
        'Please rate your support experience',
        `Ticket ${ticket.ticketNumber} has been resolved. We'd love your feedback!`
      );
    }
  }

  res.json({ message: 'Status updated' });
}

export async function assignEngineer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { engineerId } = req.body;

  if (!engineerId) {
    res.status(400).json({ error: 'engineerId is required' });
    return;
  }

  const oldEngineerId = await ticketService.assignTicket(parseInt(id), engineerId);

  // Log activity with reassignment details
  const userForAssign = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [req.user!.userId]);
  const newEngineer = await queryOne<any>('SELECT name FROM engineers WHERE id = ?', [engineerId]);
  let activityMessage: string;
  if (oldEngineerId && oldEngineerId !== engineerId) {
    const oldEngineer = await queryOne<any>('SELECT name FROM engineers WHERE id = ?', [oldEngineerId]);
    activityMessage = `Reassigned from ${oldEngineer?.name || 'Unknown'} to ${newEngineer?.name || 'Unknown'}`;
  } else {
    activityMessage = `Assigned to ${newEngineer?.name || 'Unknown'}`;
  }
  await activityService.logActivity(parseInt(id), req.user!.userId, userForAssign?.name || 'Unknown', 'assigned', activityMessage);

  const ticket = await ticketService.getTicketById(parseInt(id));
  if (ticket) {
    const engineer = ticket.assignedEngineer;
    await notificationService.createNotification(
      ticket.customerId, parseInt(id), 'assigned',
      'Engineer assigned to your ticket',
      `${engineer?.name || 'An engineer'} has been assigned to ticket ${ticket.ticketNumber}`
    );

    // Send email to engineer
    if (engineer?.email) {
      const slaPolicy = await slaService.getSlaPolicy(ticket.priority);
      emailService.sendEngineerAssignedEmail(
        engineer.email,
        engineer.name,
        ticket.ticketNumber,
        ticket.subject,
        ticket.customer.name,
        ticket.customer.company,
        ticket.createdAt,
        ticket.priority,
        !!ticket.aiAnalysis,
        slaPolicy?.response_time_hours ?? null,
        slaPolicy?.resolution_time_hours ?? null,
      );
    }
  }

  res.json({ message: 'Engineer assigned' });
}

export async function addAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let ticket;
    if (/^\d+$/.test(id)) {
      ticket = await ticketService.getTicketById(parseInt(id));
    } else {
      ticket = await ticketService.getTicketByNumber(id);
    }

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Check access: admin can add to any, customer only to own tickets
    if (req.user?.role !== 'admin' && req.user?.role !== 'engineer' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const added: any[] = [];
    await transaction(async (client) => {
      for (const file of files) {
        await clientQuery(client,
          'INSERT INTO ticket_attachments (ticket_id, filename, original_name, mime_type, size, path) VALUES (?, ?, ?, ?, ?, ?)',
          [ticket!.id, file.filename, file.originalname, file.mimetype, file.size, file.path]
        );
        added.push({ filename: file.filename, originalName: file.originalname, size: file.size });
      }
    });

    // Log activity
    const customer = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [req.user!.userId]);
    await activityService.logActivity(ticket.id, req.user!.userId, customer?.name || 'Unknown', 'attachment_added', `Added ${files.length} file(s)`);

    res.status(201).json({ message: `${files.length} file(s) uploaded`, attachments: added });
  } catch (error: any) {
    console.error('[Tickets] Add attachments error:', error);
    res.status(500).json({ error: 'Failed to upload attachments' });
  }
}

export async function addResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const ticket = await ticketService.getTicketById(ticketId);

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Check access: admin can respond to any, customer only to own tickets
    if (req.user?.role !== 'admin' && req.user?.role !== 'engineer' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { message, isInternal } = req.body;
    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Look up the user's name from customers table
    const customer = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [req.user!.userId]);
    const authorName = customer?.name || 'Unknown';
    const authorRole = req.user!.role;

    // Only admins can create internal notes
    const internal = (req.user?.role === 'admin' || req.user?.role === 'engineer') ? (isInternal || false) : false;

    const responseId = await ticketService.addResponse(ticketId, req.user!.userId, authorName, authorRole, message.trim(), internal);

    // Log activity
    await activityService.logActivity(ticketId, req.user!.userId, authorName, internal ? 'internal_note' : 'response', 'Added response');

    if (authorRole === 'admin' && !internal) {
      await notificationService.createNotification(
        ticket.customerId, ticketId, 'response',
        'New response on your ticket',
        `An engineer responded to ticket ${ticket.ticketNumber}`
      );
      emailService.sendTicketResponseEmail(
        ticket.customer.email, ticket.ticketNumber, authorName, message.trim()
      ).catch(() => {});
    }

    // Handle @mentions - notify mentioned engineers/admins
    const mentions = message.trim().match(/@(\w+(?:\s\w+)?)/g);
    if (mentions) {
      for (const mention of mentions) {
        const name = mention.substring(1).trim(); // Remove @
        // Search engineers and admins by name
        const engineer = await queryOne<any>("SELECT id, name FROM engineers WHERE LOWER(name) LIKE LOWER(?)", [`%${name}%`]);
        const admin = await queryOne<any>("SELECT id, name FROM customers WHERE role = 'admin' AND LOWER(name) LIKE LOWER(?)", [`%${name}%`]);
        if (admin) {
          await notificationService.createNotification(admin.id, ticketId, 'response', `You were mentioned in ${ticket.ticketNumber}`, `${authorName} mentioned you: "${message.trim().substring(0, 100)}..."`);
        }
      }
    }

    res.status(201).json({ id: responseId, message: 'Response added' });
  } catch (error: any) {
    console.error('[Tickets] Add response error:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
}

export async function getResponses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const ticket = await ticketService.getTicketById(ticketId);

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Check access: admin sees all, customer only own tickets
    if (req.user?.role !== 'admin' && req.user?.role !== 'engineer' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const includeInternal = (req.user?.role === 'admin' || req.user?.role === 'engineer');
    const responses = await ticketService.getResponses(ticketId, includeInternal);

    res.json(responses);
  } catch (error: any) {
    console.error('[Tickets] Get responses error:', error);
    res.status(500).json({ error: 'Failed to get responses' });
  }
}

export async function reanalyzeTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const ticketId = parseInt(id);
  const { customPrompt } = req.body || {};
  const ticket = await ticketService.getTicketById(ticketId);

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  await ticketService.updateTicketStatus(ticketId, 'analyzing');
  triggerAnalysis(ticketId, ticket.productId, ticket.categoryId, customPrompt);

  res.json({ message: 'Re-analysis triggered' });
}

export async function deleteTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);

    await transaction(async (client) => {
      // Decrement engineer workload if assigned
      const ticketResult = await clientQuery(client, 'SELECT assigned_engineer_id FROM tickets WHERE id = ?', [ticketId]);
      const ticket = ticketResult.rows[0];
      if (ticket?.assigned_engineer_id) {
        await clientQuery(client, 'UPDATE engineers SET current_workload = GREATEST(0, current_workload - 1) WHERE id = ?', [ticket.assigned_engineer_id]);
      }
      // Delete all related records before removing the ticket
      await clientQuery(client, 'DELETE FROM ticket_responses WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM ticket_attachments WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM ticket_answers WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM ticket_activity_log WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM ticket_tags WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM ticket_satisfaction WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM ticket_cc WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM ticket_links WHERE ticket_id = ? OR linked_ticket_id = ?', [ticketId, ticketId]);
      await clientQuery(client, 'DELETE FROM time_entries WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM notifications WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'UPDATE knowledge_base SET ticket_id = NULL WHERE ticket_id = ?', [ticketId]);
      await clientQuery(client, 'DELETE FROM tickets WHERE id = ?', [ticketId]);
    });

    res.json({ message: 'Ticket deleted' });
  } catch (error: any) {
    console.error('[Tickets] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
}

export async function mergeTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const targetId = parseInt(req.params.id);
    const { sourceTicketId } = req.body;

    if (!sourceTicketId) {
      res.status(400).json({ error: 'sourceTicketId is required' });
      return;
    }

    const sourceId = parseInt(sourceTicketId);
    if (sourceId === targetId) {
      res.status(400).json({ error: 'Cannot merge a ticket into itself' });
      return;
    }

    const targetTicket = await ticketService.getTicketById(targetId);
    const sourceTicket = await ticketService.getTicketById(sourceId);

    if (!targetTicket) { res.status(404).json({ error: 'Target ticket not found' }); return; }
    if (!sourceTicket) { res.status(404).json({ error: 'Source ticket not found' }); return; }

    await transaction(async (client) => {
      // Move responses from source to target
      await clientQuery(client, 'UPDATE ticket_responses SET ticket_id = ? WHERE ticket_id = ?', [targetId, sourceId]);

      // Move attachments from source to target
      await clientQuery(client, 'UPDATE ticket_attachments SET ticket_id = ? WHERE ticket_id = ?', [targetId, sourceId]);

      // Move time entries from source to target
      await clientQuery(client, 'UPDATE time_entries SET ticket_id = ? WHERE ticket_id = ?', [targetId, sourceId]);

      // Copy tags from source to target (skip duplicates)
      const sourceTags = await clientQuery(client, 'SELECT tag FROM ticket_tags WHERE ticket_id = ?', [sourceId]);
      for (const row of sourceTags.rows) {
        const exists = await clientQuery(client, 'SELECT 1 FROM ticket_tags WHERE ticket_id = ? AND tag = ?', [targetId, row.tag]);
        if (exists.rows.length === 0) {
          await clientQuery(client, 'INSERT INTO ticket_tags (ticket_id, tag) VALUES (?, ?)', [targetId, row.tag]);
        }
      }
      // Remove source tags after copying
      await clientQuery(client, 'DELETE FROM ticket_tags WHERE ticket_id = ?', [sourceId]);

      // Move custom field values from source to target (skip duplicates)
      const sourceCustomFields = await clientQuery(client,
        'SELECT field_id, value FROM ticket_custom_field_values WHERE ticket_id = ?', [sourceId]);
      for (const row of sourceCustomFields.rows) {
        await clientQuery(client,
          `INSERT INTO ticket_custom_field_values (ticket_id, field_id, value)
           VALUES (?, ?, ?)
           ON CONFLICT (ticket_id, field_id) DO NOTHING`,
          [targetId, row.field_id, row.value]);
      }
      await clientQuery(client, 'DELETE FROM ticket_custom_field_values WHERE ticket_id = ?', [sourceId]);

      // Log activity on target
      await clientQuery(client,
        'INSERT INTO ticket_activity_log (ticket_id, actor_id, actor_name, action, details) VALUES (?, ?, ?, ?, ?)',
        [targetId, req.user!.userId, req.user!.name || 'Admin', 'merged', `Merged ticket ${sourceTicket.ticketNumber} into this ticket`]
      );

      // Close source ticket and add note
      await clientQuery(client,
        "UPDATE tickets SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [sourceId]
      );
      await clientQuery(client,
        'INSERT INTO ticket_activity_log (ticket_id, actor_id, actor_name, action, details) VALUES (?, ?, ?, ?, ?)',
        [sourceId, req.user!.userId, req.user!.name || 'Admin', 'merged', `Merged into ${targetTicket.ticketNumber}`]
      );

      // Add a response on source ticket as a note
      await clientQuery(client,
        "INSERT INTO ticket_responses (ticket_id, author_id, author_name, author_role, message, is_internal) VALUES (?, ?, ?, 'admin', ?, TRUE)",
        [sourceId, req.user!.userId, req.user!.name || 'Admin', `This ticket has been merged into ${targetTicket.ticketNumber}. All responses, attachments, and time entries have been moved.`]
      );
    });

    res.json({ message: `Ticket ${sourceTicket.ticketNumber} merged into ${targetTicket.ticketNumber}` });
  } catch (error: any) {
    console.error('[Tickets] Merge error:', error);
    res.status(500).json({ error: 'Failed to merge tickets' });
  }
}

export async function updatePriority(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { priority } = req.body;
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (!validPriorities.includes(priority)) {
    res.status(400).json({ error: 'Invalid priority' });
    return;
  }
  await query("UPDATE tickets SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [priority, id]);

  // Log activity
  const userForPriority = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [req.user!.userId]);
  await activityService.logActivity(parseInt(id), req.user!.userId, userForPriority?.name || 'Unknown', 'priority_changed', `Priority changed to ${priority}`);

  res.json({ message: 'Priority updated' });
}

export async function bulkUpdateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ticketIds, status } = req.body;
  if (!Array.isArray(ticketIds) || !status) {
    res.status(400).json({ error: 'ticketIds array and status are required' });
    return;
  }
  await transaction(async (client) => {
    for (const id of ticketIds) {
      await clientQuery(client, "UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);
    }
  });
  res.json({ message: `${ticketIds.length} tickets updated` });
}

export async function bulkAssign(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ticketIds, engineerId } = req.body;
  if (!Array.isArray(ticketIds) || !engineerId) {
    res.status(400).json({ error: 'ticketIds array and engineerId are required' });
    return;
  }
  await transaction(async (client) => {
    for (const id of ticketIds) {
      const ticketResult = await clientQuery(client, 'SELECT assigned_engineer_id FROM tickets WHERE id = ?', [id]);
      const ticket = ticketResult.rows[0];
      if (ticket?.assigned_engineer_id) {
        await clientQuery(client, 'UPDATE engineers SET current_workload = GREATEST(0, current_workload - 1) WHERE id = ?', [ticket.assigned_engineer_id]);
      }
      await clientQuery(client, "UPDATE tickets SET assigned_engineer_id = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [engineerId, id]);
    }
    await clientQuery(client, "UPDATE engineers SET current_workload = current_workload + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [ticketIds.length, engineerId]);
  });
  res.json({ message: `${ticketIds.length} tickets assigned` });
}

export async function bulkDelete(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ticketIds } = req.body;
  if (!Array.isArray(ticketIds)) {
    res.status(400).json({ error: 'ticketIds array is required' });
    return;
  }
  await transaction(async (client) => {
    for (const id of ticketIds) {
      const ticketResult = await clientQuery(client, 'SELECT assigned_engineer_id FROM tickets WHERE id = ?', [id]);
      const ticket = ticketResult.rows[0];
      if (ticket?.assigned_engineer_id) {
        await clientQuery(client, 'UPDATE engineers SET current_workload = GREATEST(0, current_workload - 1) WHERE id = ?', [ticket.assigned_engineer_id]);
      }
      await clientQuery(client, 'DELETE FROM ticket_responses WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM ticket_attachments WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM ticket_answers WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM ticket_activity_log WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM ticket_tags WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM ticket_satisfaction WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM ticket_cc WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM ticket_links WHERE ticket_id = ? OR linked_ticket_id = ?', [id, id]);
      await clientQuery(client, 'DELETE FROM time_entries WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM notifications WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'UPDATE knowledge_base SET ticket_id = NULL WHERE ticket_id = ?', [id]);
      await clientQuery(client, 'DELETE FROM tickets WHERE id = ?', [id]);
    }
  });
  res.json({ message: `${ticketIds.length} tickets deleted` });
}

export async function getActivities(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const activities = await activityService.getActivities(parseInt(id));
  res.json(activities);
}

export async function addTag(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { tag } = req.body;
  if (!tag?.trim()) { res.status(400).json({ error: 'tag is required' }); return; }
  try {
    await query('INSERT INTO ticket_tags (ticket_id, tag) VALUES (?, ?) ON CONFLICT DO NOTHING', [id, tag.trim().toLowerCase()]);
    res.json({ message: 'Tag added' });
  } catch { res.status(500).json({ error: 'Failed to add tag' }); }
}

export async function removeTag(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id, tag } = req.params;
  await query('DELETE FROM ticket_tags WHERE ticket_id = ? AND tag = ?', [id, tag]);
  res.json({ message: 'Tag removed' });
}

export async function getTags(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const tags = await queryAll<any>('SELECT tag FROM ticket_tags WHERE ticket_id = ?', [id]);
  res.json(tags.map((t: any) => t.tag));
}

export async function submitSatisfaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5' });
      return;
    }

    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Check ticket belongs to customer (or user is admin)
    if (req.user?.role !== 'admin' && req.user?.role !== 'engineer' && ticket.customerId !== req.user?.userId) {
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
      await query(
        'INSERT INTO ticket_satisfaction (ticket_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)',
        [ticketId, ticket.customerId, rating, comment || null]
      );
    } catch (err: any) {
      if (err.message?.includes('unique') || err.message?.includes('duplicate') || err.code === '23505') {
        res.status(409).json({ error: 'Satisfaction rating already submitted for this ticket' });
        return;
      }
      throw err;
    }

    // Log activity
    const customer = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [req.user!.userId]);
    await activityService.logActivity(ticketId, req.user!.userId, customer?.name || 'Unknown', 'satisfaction_rated', `Rated ${rating}/5`);

    res.status(201).json({ message: 'Satisfaction rating submitted' });
  } catch (error: any) {
    console.error('[Tickets] Submit satisfaction error:', error);
    res.status(500).json({ error: 'Failed to submit satisfaction rating' });
  }
}

// ===== AI Data Extraction from Attachment =====

export async function extractAttachmentData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id, attachmentId } = req.params;
    const attachment = await queryOne<any>('SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?', [attachmentId, id]);

    if (!attachment) { res.status(404).json({ error: 'Attachment not found' }); return; }

    const fs = await import('fs');
    if (!fs.existsSync(attachment.path)) { res.status(404).json({ error: 'File not found on disk' }); return; }

    // Read file content (text-based files only)
    const textExtensions = ['.log', '.txt', '.cfg', '.conf', '.json', '.xml', '.csv', '.yaml', '.yml', '.ini', '.sip', '.sdp'];
    const ext = attachment.original_name.toLowerCase().substring(attachment.original_name.lastIndexOf('.'));
    const isText = attachment.mime_type.startsWith('text/') || attachment.mime_type === 'application/json' || textExtensions.includes(ext);

    if (!isText) {
      res.json({ extracted: null, note: 'Only text-based files can be analyzed. Binary files (pcap, zip, images) require manual review.' });
      return;
    }

    const content = fs.readFileSync(attachment.path, 'utf-8');
    const truncated = content.length > 15000 ? content.substring(0, 15000) + '\n... [truncated]' : content;

    // Extract structured info
    const lines = content.split('\n');
    const extracted = {
      fileName: attachment.original_name,
      fileSize: attachment.size,
      lineCount: lines.length,
      errors: lines.filter(l => /error|fail|fatal|exception|panic/i.test(l)).slice(0, 20).map(l => l.trim()),
      warnings: lines.filter(l => /warn|warning/i.test(l)).slice(0, 10).map(l => l.trim()),
      ipAddresses: [...new Set(content.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [])],
      timestamps: [...new Set((content.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g) || []).slice(0, 5))],
      sipMethods: [...new Set(content.match(/\b(INVITE|ACK|BYE|CANCEL|REGISTER|OPTIONS|PRACK|SUBSCRIBE|NOTIFY|PUBLISH|INFO|REFER|MESSAGE|UPDATE)\b/g) || [])],
      preview: truncated.substring(0, 2000),
    };

    res.json({ extracted });
  } catch (error: any) {
    console.error('[AI] Extract data error:', error);
    res.status(500).json({ error: 'Failed to extract data' });
  }
}

// ===== Time Entries =====

export async function getTimeEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const entries = await queryAll<any>(`
    SELECT te.*, e.name as engineer_name
    FROM time_entries te
    LEFT JOIN engineers e ON te.engineer_id = e.id
    WHERE te.ticket_id = ?
    ORDER BY te.date DESC, te.created_at DESC
  `, [id]);
  res.json(entries);
}

export async function addTimeEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { hours, description, isChargeable, engineerId, date, activityType } = req.body;

  if (!hours || hours <= 0) { res.status(400).json({ error: 'Hours must be positive' }); return; }
  if (!description?.trim()) { res.status(400).json({ error: 'Description is required' }); return; }

  const customer = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [req.user!.userId]);
  const authorName = customer?.name || 'Unknown';

  const result = await query(
    'INSERT INTO time_entries (ticket_id, engineer_id, author_id, author_name, hours, description, is_chargeable, date, activity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [id, engineerId || null, req.user!.userId, authorName, hours, description.trim(), isChargeable !== false ? true : false, date || new Date().toISOString().split('T')[0], activityType || 'general']
  );

  await activityService.logActivity(parseInt(id), req.user!.userId, authorName, 'time_logged', `Logged ${hours}h [${activityType || 'general'}]: ${description.trim()}`);

  res.status(201).json({ id: result.rows[0].id, message: 'Time entry added' });
}

export async function deleteTimeEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { entryId } = req.params;
  await query('DELETE FROM time_entries WHERE id = ?', [entryId]);
  res.json({ message: 'Time entry deleted' });
}

// ===== Timer =====

export async function startTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { activityType, description } = req.body;
  const userId = req.user!.userId;

  // Check for existing active timer
  const existing = await queryOne<any>('SELECT id, ticket_id FROM active_timers WHERE user_id = ?', [userId]);
  if (existing) {
    res.status(409).json({ error: 'Timer already running', activeTicketId: existing.ticket_id });
    return;
  }

  await query(
    'INSERT INTO active_timers (user_id, ticket_id, activity_type, description) VALUES (?, ?, ?, ?)',
    [userId, id, activityType || 'general', description || null]
  );

  res.json({ message: 'Timer started', ticketId: parseInt(id) });
}

export async function stopTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { description, isChargeable } = req.body;
  const userId = req.user!.userId;

  const timer = await queryOne<any>('SELECT * FROM active_timers WHERE user_id = ? AND ticket_id = ?', [userId, id]);
  if (!timer) {
    res.status(404).json({ error: 'No active timer for this ticket' });
    return;
  }

  // Calculate hours from elapsed time
  const elapsedMs = Date.now() - new Date(timer.started_at).getTime();
  const hours = Math.round((elapsedMs / 3600000) * 4) / 4; // Round to nearest 0.25h

  if (hours <= 0) {
    await query('DELETE FROM active_timers WHERE id = ?', [timer.id]);
    res.json({ message: 'Timer stopped (less than 15 minutes, not recorded)', hours: 0 });
    return;
  }

  const customer = await queryOne<any>('SELECT name FROM customers WHERE id = ?', [userId]);
  const authorName = customer?.name || 'Unknown';
  const finalDescription = description?.trim() || timer.description || 'Timer entry';

  const result = await query(
    'INSERT INTO time_entries (ticket_id, engineer_id, author_id, author_name, hours, description, is_chargeable, date, activity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [id, null, userId, authorName, hours, finalDescription, isChargeable !== false ? true : false, new Date().toISOString().split('T')[0], timer.activity_type]
  );

  await query('DELETE FROM active_timers WHERE id = ?', [timer.id]);
  await activityService.logActivity(parseInt(id), userId, authorName, 'time_logged', `Timer: ${hours}h [${timer.activity_type}]: ${finalDescription}`);

  res.json({ id: result.rows[0].id, hours, message: 'Timer stopped and time entry created' });
}

export async function getActiveTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const timer = await queryOne<any>(`
    SELECT at.*, t.ticket_number, t.subject
    FROM active_timers at
    JOIN tickets t ON at.ticket_id = t.id
    WHERE at.user_id = ?
  `, [userId]);
  res.json(timer || null);
}

export async function cancelTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  await query('DELETE FROM active_timers WHERE user_id = ? AND ticket_id = ?', [req.user!.userId, id]);
  res.json({ message: 'Timer cancelled' });
}

// ===== AI Suggested Reply =====

export async function suggestReply(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticket = await ticketService.getTicketById(parseInt(id));
    if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

    const responses = await ticketService.getResponses(parseInt(id), true);

    // Find similar resolved tickets
    const similarTickets = await queryAll<any>(`
      SELECT t.subject, t.description, t.ai_analysis,
             (SELECT STRING_AGG(tr.message, E'\n---\n' ORDER BY tr.created_at) FROM ticket_responses tr WHERE tr.ticket_id = t.id AND tr.author_role = 'admin' AND tr.is_internal = FALSE) as admin_responses
      FROM tickets t
      WHERE t.status IN ('resolved', 'closed')
        AND t.product_id = ?
        AND t.id != ?
      ORDER BY t.resolved_at DESC
      LIMIT 5
    `, [ticket.productId, ticket.id]);

    const conversationHistory = responses
      .filter((r: any) => !r.is_internal)
      .map((r: any) => `[${r.author_role}] ${r.message}`)
      .join('\n\n');

    const similarContext = similarTickets
      .filter((t: any) => t.admin_responses)
      .slice(0, 3)
      .map((t: any) => `Subject: ${t.subject}\nResponse: ${t.admin_responses?.substring(0, 500)}`)
      .join('\n---\n');

    // Build a prompt for AI reply suggestion
    const prompt = `You are a TelcoBridges support engineer. Suggest a helpful reply for this ticket.

## Current Ticket
- Product: ${ticket.product.name} (${ticket.product.model})
- Category: ${ticket.category.name}
- Subject: ${ticket.subject}
- Description: ${ticket.description}

## Conversation So Far
${conversationHistory || 'No responses yet.'}

${similarContext ? `## Similar Resolved Tickets (for reference)\n${similarContext}` : ''}

${ticket.aiAnalysis ? `## AI Analysis\n${typeof ticket.aiAnalysis === 'string' ? ticket.aiAnalysis : JSON.stringify(ticket.aiAnalysis, null, 2)}` : ''}

Write a professional, helpful reply. Be concise and technical. Do not include greetings like "Dear customer" - get straight to the point.`;

    // Use the configured Claude analysis mode to get suggestion
    const analysisMode = await getSetting('claude_analysis_mode') || 'disabled';

    if (analysisMode === 'disabled') {
      res.json({ suggestion: '', note: 'AI is disabled. Enable Claude AI in settings to get reply suggestions.' });
      return;
    }

    // For simplicity, use wrapper or SSH service
    if (analysisMode === 'wrapper') {
      const { analyzeTicketViaWrapper } = await import('../services/claude-wrapper.service');
      const result = await analyzeTicketViaWrapper({
        ticketNumber: ticket.ticketNumber,
        productName: ticket.product.name,
        productModel: ticket.product.model,
        categoryName: ticket.category.name,
        subject: ticket.subject,
        description: ticket.description,
        answers: [],
        attachments: [],
        engineers: [],
        customPrompt: `IMPORTANT: This is NOT a ticket analysis request. This is a REPLY SUGGESTION request.
You must write a professional support reply that will be sent to the customer. Do NOT produce JSON. Do NOT produce an analysis report.

Write ONLY the reply text — no preamble, no "Here's the reply:", no JSON, no thinking out loud.

Context for writing the reply:

${prompt}

Write the reply now. Plain text only, professional tone, concise and technical.`,
      });

      // Extract the actual text from Claude CLI JSON envelope
      let suggestion = '';
      if (result.rawOutput) {
        try {
          const envelope = JSON.parse(result.rawOutput);
          suggestion = envelope?.result || envelope?.content?.[0]?.text || '';
        } catch {
          suggestion = result.rawOutput;
        }
      }
      // Remove any JSON blocks or thinking preamble
      suggestion = suggestion.replace(/\{[\s\S]*"classification"[\s\S]*\}/g, '').trim();
      // Remove common AI preamble lines
      suggestion = suggestion.replace(/^(I now have|Let me|Here's|Here is|Now I|Based on).*?\n\n/s, '').trim();
      if (!suggestion) suggestion = 'Unable to generate suggestion. Please compose your reply manually.';

      res.json({ suggestion });
    } else {
      // Fallback: return similar tickets' responses as suggestion
      const fallbackSuggestion = similarTickets
        .filter((t: any) => t.admin_responses)
        .slice(0, 1)
        .map((t: any) => t.admin_responses?.substring(0, 1000))
        .join('') || 'No similar resolved tickets found to base a suggestion on. Please compose your reply manually.';
      res.json({ suggestion: fallbackSuggestion, note: 'Based on similar resolved tickets.' });
    }
  } catch (error: any) {
    console.error('[AI] Suggest reply error:', error);
    res.json({ suggestion: '', note: 'Failed to generate suggestion. Please compose your reply manually.' });
  }
}

// ===== Knowledge Base =====

export async function createKbArticle(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticket = await ticketService.getTicketById(parseInt(id));
    if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

    const { title, content } = req.body;

    const responses = await ticketService.getResponses(parseInt(id), false);
    const adminResponses = responses.filter((r: any) => r.author_role === 'admin');

    const articleTitle = title || `${ticket.product.name}: ${ticket.subject}`;
    const articleContent = content || `## Problem\n${ticket.description}\n\n## Solution\n${adminResponses.map((r: any) => r.message).join('\n\n')}`;

    const tags = [ticket.product.name, ticket.category.name].join(',');

    const result = await query(
      'INSERT INTO knowledge_base (ticket_id, title, content, product_id, category_id, tags, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [ticket.id, articleTitle, articleContent, ticket.productId, ticket.categoryId, tags, req.user!.userId]
    );

    await activityService.logActivity(parseInt(id), req.user!.userId, 'Admin', 'kb_article_created', `Knowledge base article created: ${articleTitle}`);

    res.status(201).json({ id: result.rows[0].id, message: 'Knowledge base article created' });
  } catch (error: any) {
    console.error('[KB] Create article error:', error);
    res.status(500).json({ error: 'Failed to create KB article' });
  }
}

// ===== CC Users =====

export async function getCcUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const cc = await queryAll<any>('SELECT * FROM ticket_cc WHERE ticket_id = ? ORDER BY created_at', [id]);
  res.json(cc);
}

export async function addCcUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { email, name } = req.body;
  if (!email?.trim()) { res.status(400).json({ error: 'Email is required' }); return; }
  try {
    await query('INSERT INTO ticket_cc (ticket_id, email, name) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [id, email.trim().toLowerCase(), name || null]);
    await activityService.logActivity(parseInt(id), req.user!.userId, req.user!.email || 'Unknown', 'cc_added', `Added CC: ${email}`);
    res.json({ message: 'CC user added' });
  } catch { res.status(500).json({ error: 'Failed to add CC user' }); }
}

export async function removeCcUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id, email } = req.params;
  await query('DELETE FROM ticket_cc WHERE ticket_id = ? AND email = ?', [id, decodeURIComponent(email)]);
  res.json({ message: 'CC user removed' });
}

// ===== Linked Tickets =====

export async function getLinkedTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const links = await queryAll<any>(`
    SELECT tl.*,
           t.ticket_number, t.subject, t.status, t.priority
    FROM ticket_links tl
    JOIN tickets t ON t.id = tl.linked_ticket_id
    WHERE tl.ticket_id = ?
    UNION
    SELECT tl.id, tl.linked_ticket_id as ticket_id, tl.ticket_id as linked_ticket_id,
           CASE tl.link_type WHEN 'parent' THEN 'child' WHEN 'child' THEN 'parent' ELSE tl.link_type END as link_type,
           tl.created_by, tl.created_at,
           t.ticket_number, t.subject, t.status, t.priority
    FROM ticket_links tl
    JOIN tickets t ON t.id = tl.ticket_id
    WHERE tl.linked_ticket_id = ?
    ORDER BY created_at DESC
  `, [id, id]);
  res.json(links);
}

export async function linkTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { linkedTicketId, linkType } = req.body;

  if (!linkedTicketId) { res.status(400).json({ error: 'linkedTicketId is required' }); return; }

  // Resolve linkedTicketId - support ticket number
  let resolvedId = linkedTicketId;
  if (typeof linkedTicketId === 'string' && !/^\d+$/.test(linkedTicketId)) {
    const ticket = await queryOne<any>('SELECT id FROM tickets WHERE ticket_number = ?', [linkedTicketId]);
    if (!ticket) { res.status(404).json({ error: 'Linked ticket not found' }); return; }
    resolvedId = ticket.id;
  }

  if (parseInt(id) === parseInt(resolvedId)) { res.status(400).json({ error: 'Cannot link ticket to itself' }); return; }

  const validTypes = ['related', 'parent', 'child', 'duplicate', 'references'];
  const type = validTypes.includes(linkType) ? linkType : 'related';

  try {
    await query('INSERT INTO ticket_links (ticket_id, linked_ticket_id, link_type, created_by) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING', [id, resolvedId, type, req.user!.userId]);
    const linked = await queryOne<any>('SELECT ticket_number FROM tickets WHERE id = ?', [resolvedId]);
    await activityService.logActivity(parseInt(id), req.user!.userId, 'Admin', 'ticket_linked', `Linked to ${linked?.ticket_number || resolvedId} (${type})`);
    res.json({ message: 'Tickets linked' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to link tickets' });
  }
}

export async function unlinkTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { linkId } = req.params;
  await query('DELETE FROM ticket_links WHERE id = ?', [linkId]);
  res.json({ message: 'Link removed' });
}

// ===== Jira Issue Key =====

export async function updateJiraKey(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { jiraIssueKey } = req.body;
  await query("UPDATE tickets SET jira_issue_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [jiraIssueKey || null, id]);
  await activityService.logActivity(parseInt(id), req.user!.userId, 'Admin', 'jira_linked', jiraIssueKey ? `Linked to Jira: ${jiraIssueKey}` : 'Jira link removed');
  res.json({ message: 'Jira issue key updated' });
}

// ===== Jira Escalation =====

export async function escalateToJira(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let ticket;
    if (/^\d+$/.test(id)) {
      ticket = await ticketService.getTicketById(parseInt(id));
    } else {
      ticket = await ticketService.getTicketByNumber(id);
    }

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Dynamically import to avoid circular deps
    const { createJiraIssue } = await import('../services/jira.service');
    const { labels, account, affectedVersion, escalationNotes } = req.body || {};
    const result = await createJiraIssue({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      productName: ticket.product.name,
      categoryName: ticket.category.name,
      customerName: ticket.customer.name,
      customerEmail: ticket.customer.email,
      labels,
      account,
      affectedVersion,
      escalationNotes,
    }, ticket.assignedEngineerId || undefined);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Update ticket with Jira key and status
    await query("UPDATE tickets SET jira_issue_key = ?, status = 'escalated_to_jira', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [result.issueKey, ticket.id]);

    await activityService.logActivity(ticket.id, req.user!.userId, 'Admin', 'escalated_to_jira', `Escalated to Jira: ${result.issueKey}`);

    await notificationService.createNotification(
      ticket.customerId, ticket.id, 'status_change',
      'Ticket escalated to engineering',
      `Ticket ${ticket.ticketNumber} has been escalated to our engineering team (${result.issueKey}).`
    );

    res.json({ issueKey: result.issueKey, issueUrl: result.issueUrl, message: 'Ticket escalated to Jira' });
  } catch (error: any) {
    console.error('[Jira] Escalation error:', error);
    res.status(500).json({ error: 'Failed to escalate to Jira' });
  }
}

export async function getJiraStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const ticket = await ticketService.getTicketById(parseInt(id));
  if (!ticket || !ticket.jiraIssueKey) {
    res.json(null);
    return;
  }
  const { getJiraIssueStatus } = await import('../services/jira.service');
  const status = await getJiraIssueStatus(ticket.jiraIssueKey, ticket.assignedEngineerId || undefined);
  res.json(status);
}

export async function getSatisfaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);

    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (req.user?.role !== 'admin' && req.user?.role !== 'engineer' && ticket.customerId !== req.user?.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const satisfaction = await queryOne<any>(
      'SELECT rating, comment, created_at as "createdAt" FROM ticket_satisfaction WHERE ticket_id = ?',
      [ticketId]
    );

    res.json(satisfaction || null);
  } catch (error: any) {
    console.error('[Tickets] Get satisfaction error:', error);
    res.status(500).json({ error: 'Failed to get satisfaction rating' });
  }
}
