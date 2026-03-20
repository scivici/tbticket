import { getDb } from '../db/connection';
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
  answers: { questionTemplateId: number; answer: string }[];
  files?: Express.Multer.File[];
}

export function createTicket(data: CreateTicketData) {
  const db = getDb();
  const ticketNumber = generateTicketNumber();

  const insertTicket = db.prepare(`
    INSERT INTO tickets (ticket_number, customer_id, product_id, category_id, subject, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertAnswer = db.prepare(`
    INSERT INTO ticket_answers (ticket_id, question_template_id, answer)
    VALUES (?, ?, ?)
  `);

  const insertAttachment = db.prepare(`
    INSERT INTO ticket_attachments (ticket_id, filename, original_name, mime_type, size, path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = db.transaction(() => {
    const ticketResult = insertTicket.run(
      ticketNumber, data.customerId, data.productId, data.categoryId,
      data.subject, data.description
    );
    const ticketId = ticketResult.lastInsertRowid as number;

    for (const answer of data.answers) {
      insertAnswer.run(ticketId, answer.questionTemplateId, answer.answer);
    }

    if (data.files) {
      for (const file of data.files) {
        insertAttachment.run(
          ticketId, file.filename, file.originalname,
          file.mimetype, file.size, file.path
        );
      }
    }

    return { ticketId, ticketNumber };
  })();

  return result;
}

export function getTicketById(ticketId: number) {
  const db = getDb();

  const ticket = db.prepare(`
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
  `).get(ticketId) as any;

  if (!ticket) return null;

  const answers = db.prepare(`
    SELECT ta.*, qt.question_text, qt.question_type
    FROM ticket_answers ta
    JOIN question_templates qt ON ta.question_template_id = qt.id
    WHERE ta.ticket_id = ?
    ORDER BY qt.display_order
  `).all(ticketId);

  const attachments = db.prepare(`
    SELECT * FROM ticket_attachments WHERE ticket_id = ?
  `).all(ticketId);

  return {
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    customerId: ticket.customer_id,
    productId: ticket.product_id,
    categoryId: ticket.category_id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    assignedEngineerId: ticket.assigned_engineer_id,
    aiAnalysis: ticket.ai_analysis,
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

export function getTicketByNumber(ticketNumber: string) {
  const db = getDb();
  const ticket = db.prepare('SELECT id FROM tickets WHERE ticket_number = ?').get(ticketNumber) as any;
  if (!ticket) return null;
  return getTicketById(ticket.id);
}

export function listTickets(filters: {
  status?: string;
  priority?: string;
  productId?: number;
  assignedEngineerId?: number;
  customerId?: number;
  page?: number;
  limit?: number;
}) {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.status) {
    conditions.push('t.status = ?');
    params.push(filters.status);
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
    conditions.push('t.customer_id = ?');
    params.push(filters.customerId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM tickets t ${where}`).get(...params) as any;

  const tickets = db.prepare(`
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
  `).all(...params, limit, offset);

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
    total: countResult.total,
    page,
    limit,
    totalPages: Math.ceil(countResult.total / limit),
  };
}

export function updateTicketStatus(ticketId: number, status: string) {
  const db = getDb();
  const updates: string[] = ["status = ?", "updated_at = datetime('now')"];
  const params: any[] = [status];

  if (status === 'resolved') {
    updates.push("resolved_at = datetime('now')");
  }

  db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params, ticketId);
}

export function assignTicket(ticketId: number, engineerId: number) {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`
      UPDATE tickets SET assigned_engineer_id = ?, status = 'assigned', updated_at = datetime('now')
      WHERE id = ?
    `).run(engineerId, ticketId);

    db.prepare(`
      UPDATE engineers SET current_workload = current_workload + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(engineerId);
  })();
}

export function updateAiAnalysis(ticketId: number, analysis: string, confidence: number) {
  const db = getDb();
  db.prepare(`
    UPDATE tickets SET ai_analysis = ?, ai_confidence = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(analysis, confidence, ticketId);
}
