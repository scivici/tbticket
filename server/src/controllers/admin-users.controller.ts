import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection';

export function listAdmins(_req: Request, res: Response): void {
  const db = getDb();
  const admins = db.prepare(
    'SELECT id, email, name, role, created_at FROM customers WHERE role = ? ORDER BY created_at'
  ).all('admin');
  res.json(admins);
}

export function createAdmin(req: Request, res: Response): void {
  const db = getDb();
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name, and password are required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already exists' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO customers (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(email, name, passwordHash, 'admin');

  res.status(201).json({ id: result.lastInsertRowid, message: 'Admin created' });
}

export function updateAdmin(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { name, email } = req.body;

  const existing = db.prepare('SELECT id, email FROM customers WHERE id = ? AND role = ?').get(id, 'admin') as any;
  if (!existing) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  if (email && email !== existing.email) {
    const duplicate = db.prepare('SELECT id FROM customers WHERE email = ? AND id != ?').get(email, id);
    if (duplicate) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
  }

  db.prepare(
    'UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?'
  ).run(name, email, id);

  res.json({ message: 'Admin updated' });
}

export function changePassword(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM customers WHERE id = ? AND role = ?').get(id, 'admin');
  if (!existing) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').run(passwordHash, id);

  res.json({ message: 'Password changed' });
}

export function changeMyPassword(req: any, res: Response): void {
  const db = getDb();
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  const user = db.prepare('SELECT id, password_hash FROM customers WHERE id = ?').get(userId) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').run(passwordHash, userId);

  res.json({ message: 'Password changed' });
}

export function deleteAdmin(req: any, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const currentUserId = req.user.userId;

  if (Number(id) === Number(currentUserId)) {
    res.status(409).json({ error: 'Cannot delete your own account' });
    return;
  }

  const existing = db.prepare('SELECT id FROM customers WHERE id = ? AND role = ?').get(id, 'admin');
  if (!existing) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const count = db.prepare('SELECT COUNT(*) as cnt FROM customers WHERE role = ?').get('admin') as any;
  if (count.cnt <= 1) {
    res.status(409).json({ error: 'Cannot delete the last admin' });
    return;
  }

  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  res.json({ message: 'Admin deleted' });
}
