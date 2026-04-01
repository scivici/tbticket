import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query, queryOne } from '../db/connection';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name, company } = req.body;

  if (!email || !password || !name || !company) {
    res.status(400).json({ error: 'Email, password, name, and company are required' });
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
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await query(
    'INSERT INTO customers (email, name, company, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [email, name, company || null, passwordHash, 'customer']
  );

  const userId = result.rows[0].id;
  const token = jwt.sign(
    { userId, email, role: 'customer', isAnonymous: false },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.status(201).json({
    token,
    user: { id: userId, email, name, company: company || null, role: 'customer', isAnonymous: false },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  // Check customers table first (admin/customer)
  const user = await queryOne<any>('SELECT * FROM customers WHERE email = ? AND password_hash IS NOT NULL', [email]);

  if (user && bcrypt.compareSync(password, user.password_hash)) {
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, isAnonymous: false },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isAnonymous: false },
    });
    return;
  }

  // Check engineers table (engineer login)
  const engineer = await queryOne<any>('SELECT * FROM engineers WHERE email = ? AND password_hash IS NOT NULL', [email]);

  if (engineer && bcrypt.compareSync(password, engineer.password_hash)) {
    const token = jwt.sign(
      { userId: engineer.id, email: engineer.email, role: 'engineer', isAnonymous: false, engineerId: engineer.id },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    res.json({
      token,
      user: { id: engineer.id, email: engineer.email, name: engineer.name, role: 'engineer', isAnonymous: false, engineerId: engineer.id },
    });
    return;
  }

  res.status(401).json({ error: 'Invalid email or password' });
}

export async function anonymous(req: Request, res: Response): Promise<void> {
  const { email, name } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  let user = await queryOne<any>('SELECT * FROM customers WHERE email = ?', [email]);

  if (!user) {
    const result = await query(
      'INSERT INTO customers (email, name, is_anonymous) VALUES (?, ?, TRUE) RETURNING id',
      [email, name || 'Anonymous']
    );
    user = { id: result.rows[0].id, email, name: name || 'Anonymous', role: 'customer' };
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, isAnonymous: true },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, isAnonymous: true },
  });
}

export async function getMe(req: any, res: Response): Promise<void> {
  // If engineer role, fetch from engineers table
  if (req.user.role === 'engineer') {
    const engineer = await queryOne<any>('SELECT id, email, name FROM engineers WHERE id = ?', [req.user.engineerId || req.user.userId]);
    if (!engineer) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: engineer.id,
      email: engineer.email,
      name: engineer.name,
      role: 'engineer',
      isAnonymous: false,
      engineerId: engineer.id,
    });
    return;
  }

  const user = await queryOne<any>('SELECT id, email, name, company, role, is_anonymous FROM customers WHERE id = ?', [req.user.userId]);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    company: user.company,
    role: user.role,
    isAnonymous: !!user.is_anonymous,
  });
}

export async function updateProfile(req: any, res: Response): Promise<void> {
  const { name, company } = req.body;
  await query('UPDATE customers SET name = COALESCE(?, name), company = COALESCE(?, company), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name || null, company || null, req.user.userId]);
  res.json({ message: 'Profile updated' });
}

export async function changePassword(req: any, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
    return;
  }
  const user = await queryOne<any>('SELECT password_hash FROM customers WHERE id = ?', [req.user.userId]);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }
  await query('UPDATE customers SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [bcrypt.hashSync(newPassword, 10), req.user.userId]);
  res.json({ message: 'Password changed' });
}
