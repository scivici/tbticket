import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth';
import { query, queryOne, queryAll } from '../db/connection';
import { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * Middleware: require customer who is a company admin.
 */
function requireCompanyAdmin(req: AuthenticatedRequest, res: Response, next: () => void): void {
  if (req.user?.role === 'admin') {
    // System admins can also use these endpoints
    next();
    return;
  }
  if (req.user?.role !== 'customer') {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  // Check is_company_admin flag
  queryOne<any>('SELECT is_company_admin, company FROM customers WHERE id = ?', [req.user.userId])
    .then(customer => {
      if (!customer?.is_company_admin || !customer.company) {
        res.status(403).json({ error: 'You are not a company administrator' });
        return;
      }
      (req as any).companyName = customer.company;
      next();
    })
    .catch(() => res.status(500).json({ error: 'Internal error' }));
}

/**
 * GET /company/users — List all users in the same company
 */
router.get('/users', authenticate, requireCompanyAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const companyName = (req as any).companyName;
  const users = await queryAll<any>(
    `SELECT id, email, name, company, role, is_anonymous, is_company_admin,
            can_create_tickets, company_ticket_visibility, created_at
     FROM customers
     WHERE company = ? AND is_anonymous = FALSE
     ORDER BY is_company_admin DESC, name ASC`,
    [companyName]
  );
  res.json(users);
});

/**
 * POST /company/users — Create a new user under the same company
 */
router.post('/users', authenticate, requireCompanyAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const companyName = (req as any).companyName;
  const { email, name, password, canCreateTickets, companyTicketVisibility, isCompanyAdmin } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name, and password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(400).json({ error: 'Password must contain uppercase, lowercase, and a number' });
    return;
  }

  const existing = await queryOne<any>('SELECT id FROM customers WHERE email = ?', [email]);
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await query(
    `INSERT INTO customers (email, name, company, password_hash, role, is_company_admin, can_create_tickets, company_ticket_visibility)
     VALUES (?, ?, ?, ?, 'customer', ?, ?, ?) RETURNING id`,
    [email, name, companyName, passwordHash, !!isCompanyAdmin, canCreateTickets !== false, !!companyTicketVisibility]
  );

  res.status(201).json({ id: result.rows[0].id, message: 'User created successfully' });
});

/**
 * PATCH /company/users/:userId — Update a user's permissions
 */
router.patch('/users/:userId', authenticate, requireCompanyAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const companyName = (req as any).companyName;
  const userId = parseInt(req.params.userId as string);
  const { canCreateTickets, companyTicketVisibility, isCompanyAdmin, name } = req.body;

  // Ensure the target user belongs to the same company
  const targetUser = await queryOne<any>('SELECT id, company FROM customers WHERE id = ?', [userId]);
  if (!targetUser || targetUser.company !== companyName) {
    res.status(404).json({ error: 'User not found in your company' });
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (canCreateTickets !== undefined) {
    updates.push('can_create_tickets = ?');
    params.push(!!canCreateTickets);
  }
  if (companyTicketVisibility !== undefined) {
    updates.push('company_ticket_visibility = ?');
    params.push(!!companyTicketVisibility);
  }
  if (isCompanyAdmin !== undefined) {
    updates.push('is_company_admin = ?');
    params.push(!!isCompanyAdmin);
  }
  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(userId);

  await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ message: 'User updated' });
});

/**
 * DELETE /company/users/:userId — Remove a user from the company
 */
router.delete('/users/:userId', authenticate, requireCompanyAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const companyName = (req as any).companyName;
  const userId = parseInt(req.params.userId as string);

  // Cannot delete yourself
  if (userId === req.user!.userId) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const targetUser = await queryOne<any>('SELECT id, company FROM customers WHERE id = ?', [userId]);
  if (!targetUser || targetUser.company !== companyName) {
    res.status(404).json({ error: 'User not found in your company' });
    return;
  }

  // Soft delete: remove password and mark as inactive (keep for ticket history)
  await query(
    "UPDATE customers SET password_hash = NULL, name = name || ' (deleted)', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [userId]
  );
  res.json({ message: 'User removed' });
});

/**
 * POST /company/users/:userId/reset-password — Reset a user's password
 */
router.post('/users/:userId/reset-password', authenticate, requireCompanyAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const companyName = (req as any).companyName;
  const userId = parseInt(req.params.userId as string);
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const targetUser = await queryOne<any>('SELECT id, company FROM customers WHERE id = ?', [userId]);
  if (!targetUser || targetUser.company !== companyName) {
    res.status(404).json({ error: 'User not found in your company' });
    return;
  }

  await query('UPDATE customers SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [bcrypt.hashSync(newPassword, 10), userId]);
  res.json({ message: 'Password reset successfully' });
});

export default router;
