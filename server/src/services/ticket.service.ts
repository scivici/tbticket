import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

function generateTicketNumber(): string {
  const prefix = 'TKT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().substring(0, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export interface CreateTicketData {
  customerId: number;
  productId: number;
  categoryId: number;
  subject: string;
  description: string;
  productKey?: string;
  answers: { questionTemplateId: number; answer: string }[];
  files?: Express.Multer.File[];
}

export async function createTicket(data: CreateTicketData) {
  const ticketNumber = generateTicketNumber();

  const result = await transaction(async (client) => {
    const ticketResult = await clientQuery(client, `
      INSERT INTO tickets (ticket_number, customer_id, product_id, category_id, subject, description, product_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [ticketNumber, data.customerId, data.productId, data.categoryId,
        data.subject, data.description, data.productKey || null]);
    const ticketId = ticketResult.rows[0].id as number;

    for (const answer of data.answers) {
      await clientQuery(client, `
        INSERT INTO ticket_answers (ticket_id, question_template_id, answer)
        VALUES (?, ?, ?)
      `, [ticketId, answer.questionTemplateId, answer.answer]);
    }

    if (data.files) {
      for (const file of data.files) {
        await clientQuery(client, `
          INSERT INTO ticket_attachments (ticket_id, filename, original_name, mime_type, size, path)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [ticketId, file.filename, file.originalname,
            file.mimetype, file.size, file.path]);
      }
    }

    return { ticketId, ticketNumber };
  });

  return result;
}

export async function getTicketById(ticketId: number) {
  const ticket = await queryOne<any>(`
    SELECT t.*,
           p.name as product_name, p.model as product_model, p.description as product_description,
           pc.name as category_name, pc.description as category_description,
           e.name as engineer_name, e.email as engineer_email, e.location as engineer_location,
           c.email as customer_email, c.name as customer_name
    FROM tickets t
    JOIN products p ON t.product_id = p.id
    JOIN product_categories pc ON t.category_id = pc.id
    LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
    JOIN customers c ON t.customer_id = c.id
    WHERE t.id = ?
  `, [ticketId]);

  if (!ticket) return null;

  const answers = await queryAll(`
    SELECT ta.*, qt.question_text, qt.question_type
    FROM ticket_answers ta
    JOIN question_templates qt ON ta.question_template_id = qt.id
    WHERE ta.ticket_id = ?
    ORDER BY qt.display_order
  `, [ticketId]);

  const attachments = await queryAll(`
    SELECT * FROM ticket_attachments WHERE ticket_id = ?
  `, [ticketId]);

  return {
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    customerId: ticket.customer_id,
    productId: ticket.product_id,
    categoryId: ticket.category_id,
    subject: ticket.subject,
    description: ticket.description,
    productKey: ticket.product_key,
    status: ticket.status,
    priority: ticket.priority,
    assignedEngineerId: ticket.assigned_engineer_id,
    jiraIssueKey: ticket.jira_issue_key,
    aiAnalysis: ticket.ai_analysis,
    aiAnalysisHistory: ticket.ai_analysis_history || [],
    aiConfidence: ticket.ai_confidence,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    resolvedAt: ticket.resolved_at,
    product: {
      id: ticket.product_id,
      name: ticket.product_name,
      model: ticket.product_model,
      description: ticket.product_description,
    },
    category: {
      id: ticket.category_id,
      name: ticket.category_name,
      description: ticket.category_description,
    },
    answers,
    attachments,
    assignedEngineer: ticket.assigned_engineer_id ? {
      id: ticket.assigned_engineer_id,
      name: ticket.engineer_name,
      email: ticket.engineer_email,
      location: ticket.engineer_location,
    } : null,
    customer: {
      id: ticket.customer_id,
      email: ticket.customer_email,
      name: ticket.customer_name,
    },
  };
}

export async function getTicketByNumber(ticketNumber: string) {
  const ticket = await queryOne<any>('SELECT id FROM tickets WHERE ticket_number = ?', [ticketNumber]);
  if (!ticket) return null;
  return getTicketById(ticket.id);
}

export async function listTickets(filters: {
  status?: string;
  excludeStatus?: string;
  priority?: string;
  productId?: number;
  assignedEngineerId?: number;
  customerId?: number;
  includeCompanyTickets?: boolean;
  customerSearch?: string;
  tag?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.status) {
    conditions.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.excludeStatus) {
    conditions.push('t.status != ?');
    params.push(filters.excludeStatus);
  }
  if (filters.priority) {
    conditions.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.productId) {
    conditions.push('t.product_id = ?');
    params.push(filters.productId);
  }
  if (filters.assignedEngineerId) {
    conditions.push('t.assigned_engineer_id = ?');
    params.push(filters.assignedEngineerId);
  }
  if (filters.customerId) {
    if (filters.includeCompanyTickets) {
      // Include tickets from same company
      conditions.push('(t.customer_id = ? OR c.company = (SELECT company FROM customers WHERE id = ? AND company IS NOT NULL AND company != \'\'))');
      params.push(filters.customerId, filters.customerId);
    } else {
      conditions.push('t.customer_id = ?');
      params.push(filters.customerId);
    }
  }
  if (filters.customerSearch) {
    conditions.push('(c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)');
    const term = `%${filters.customerSearch}%`;
    params.push(term, term, term);
  }
  if (filters.tag) {
    conditions.push('EXISTS (SELECT 1 FROM ticket_tags tt WHERE tt.ticket_id = t.id AND tt.tag = ?)');
    params.push(filters.tag.toLowerCase());
  }
  if (filters.search) {
    conditions.push('(t.subject LIKE ? OR t.description LIKE ? OR t.ticket_number LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.fromDate) {
    conditions.push('t.created_at >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    conditions.push('t.created_at <= ?');
    params.push(filters.toDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<any>(`SELECT COUNT(*) as total FROM tickets t JOIN customers c ON t.customer_id = c.id ${where}`, params);

  const tickets = await queryAll<any>(`
    SELECT t.*,
           p.name as product_name, p.model as product_model,
           pc.name as category_name,
           e.name as engineer_name,
           c.email as customer_email, c.name as customer_name
    FROM tickets t
    JOIN products p ON t.product_id = p.id
    JOIN product_categories pc ON t.category_id = pc.id
    LEFT JOIN engineers e ON t.assigned_engineer_id = e.id
    JOIN customers c ON t.customer_id = c.id
    ${where}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return {
    tickets: tickets.map((t: any) => ({
      id: t.id,
      ticketNumber: t.ticket_number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      productName: t.product_name,
      categoryName: t.category_name,
      engineerName: t.engineer_name,
      customerEmail: t.customer_email,
      customerName: t.customer_name,
      aiConfidence: t.ai_confidence,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
    total: countResult?.total || 0,
    page,
    limit,
    totalPages: Math.ceil((countResult?.total || 0) / limit),
  };
}

export async function updateTicketStatus(ticketId: number, status: string) {
  const updates: string[] = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
  const params: any[] = [status];

  if (status === 'resolved') {
    updates.push("resolved_at = CURRENT_TIMESTAMP");
  }

  await query(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, [...params, ticketId]);
}

export async function assignTicket(ticketId: number, engineerId: number): Promise<number | null> {
  // Returns the old engineer ID if this is a reassignment, or null if first assignment
  let oldEngineerId: number | null = null;

  await transaction(async (client) => {
    // Check if ticket already has an assigned engineer
    const existing = await clientQuery(client, `
      SELECT assigned_engineer_id FROM tickets WHERE id = ?
    `, [ticketId]);
    oldEngineerId = existing?.rows?.[0]?.assigned_engineer_id || null;

    // If reassigning, decrement old engineer's workload
    if (oldEngineerId && oldEngineerId !== engineerId) {
      await clientQuery(client, `
        UPDATE engineers SET current_workload = GREATEST(0, current_workload - 1), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [oldEngineerId]);
    }

    await clientQuery(client, `
      UPDATE tickets SET assigned_engineer_id = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [engineerId, ticketId]);

    // Only increment new engineer's workload if it's a different engineer
    if (oldEngineerId !== engineerId) {
      await clientQuery(client, `
        UPDATE engineers SET current_workload = current_workload + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [engineerId]);
    }
  });

  return oldEngineerId;
}

export async function updateAiAnalysis(ticketId: number, analysis: string, confidence: number) {
  // Archive existing analysis before overwriting
  await query(`
    UPDATE tickets SET
      ai_analysis_history = COALESCE(ai_analysis_history, '[]'::jsonb) || CASE WHEN ai_analysis IS NOT NULL THEN jsonb_build_array(ai_analysis || jsonb_build_object('archivedAt', to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) ELSE '[]'::jsonb END,
      ai_analysis = ?::jsonb,
      ai_confidence = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [analysis, confidence, ticketId]);
}

export async function addResponse(ticketId: number, authorId: number, authorName: string, authorRole: string, message: string, isInternal: boolean) {
  const result = await query(
    'INSERT INTO ticket_responses (ticket_id, author_id, author_name, author_role, message, is_internal) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [ticketId, authorId, authorName, authorRole, message, isInternal]
  );
  return result.rows[0].id;
}

export async function getResponses(ticketId: number, includeInternal: boolean) {
  const where = includeInternal ? '' : 'AND is_internal = FALSE';
  return await queryAll(
    `SELECT * FROM ticket_responses WHERE ticket_id = ? ${where} ORDER BY created_at ASC`,
    [ticketId]
  );
}
