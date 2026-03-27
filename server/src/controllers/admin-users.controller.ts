import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, queryAll } from '../db/connection';

export async function listAdmins(_req: Request, res: Response): Promise<void> {
  const admins = await queryAll<any>(
    'SELECT id, email, name, role, created_at FROM customers WHERE role = ? ORDER BY created_at',
    ['admin']
  );
  res.json(admins);
}

export async function createAdmin(req: Request, res: Response): Promise<void> {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name, and password are required' });
    return;
  }

  const existing = await queryOne<any>('SELECT id FROM customers WHERE email = ?', [email]);
  if (existing) {
    res.status(409).json({ error: 'Email already exists' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await query(
    'INSERT INTO customers (email, name, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id',
    [email, name, passwordHash, 'admin']
  );

  res.status(201).json({ id: result.rows[0].id, message: 'Admin created' });
}

export async function updateAdmin(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, email } = req.body;

  const existing = await queryOne<any>('SELECT id, email FROM customers WHERE id = ? AND role = ?', [id, 'admin']);
  if (!existing) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  if (email && email !== existing.email) {
    const duplicate = await queryOne<any>('SELECT id FROM customers WHERE email = ? AND id != ?', [email, id]);
    if (duplicate) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
  }

  await query(
    'UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
    [name, email, id]
  );

  res.json({ message: 'Admin updated' });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const existing = await queryOne<any>('SELECT id FROM customers WHERE id = ? AND role = ?', [id, 'admin']);
  if (!existing) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  await query('UPDATE customers SET password_hash = ? WHERE id = ?', [passwordHash, id]);

  res.json({ message: 'Password changed' });
}

export async function changeMyPassword(req: any, res: Response): Promise<void> {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  const user = await queryOne<any>('SELECT id, password_hash FROM customers WHERE id = ?', [userId]);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await query('UPDATE customers SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

  res.json({ message: 'Password changed' });
}

export async function deleteAdmin(req: any, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUserId = req.user.userId;

  if (Number(id) === Number(currentUserId)) {
    res.status(409).json({ error: 'Cannot delete your own account' });
    return;
  }

  const existing = await queryOne<any>('SELECT id FROM customers WHERE id = ? AND role = ?', [id, 'admin']);
  if (!existing) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const count = await queryOne<any>('SELECT COUNT(*) as cnt FROM customers WHERE role = ?', ['admin']);
  if (count.cnt <= 1) {
    res.status(409).json({ error: 'Cannot delete the last admin' });
    return;
  }

  await query('DELETE FROM customers WHERE id = ?', [id]);
  res.json({ message: 'Admin deleted' });
}
