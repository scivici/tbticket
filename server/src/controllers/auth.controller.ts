import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../db/connection';

export function register(req: Request, res: Response): void {
  const { email, password, name, company } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Email, password, and name are required' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO customers (email, name, company, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(email, name, company || null, passwordHash, 'customer');

  const userId = result.lastInsertRowid as number;
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

export function login(req: Request, res: Response): void {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM customers WHERE email = ? AND password_hash IS NOT NULL').get(email) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, isAnonymous: false },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, isAnonymous: false },
  });
}

export function anonymous(req: Request, res: Response): void {
  const { email, name } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const db = getDb();
  let user = db.prepare('SELECT * FROM customers WHERE email = ?').get(email) as any;

  if (!user) {
    const result = db.prepare(
      'INSERT INTO customers (email, name, is_anonymous) VALUES (?, ?, 1)'
    ).run(email, name || 'Anonymous');
    user = { id: result.lastInsertRowid, email, name: name || 'Anonymous', role: 'customer' };
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

export function getMe(req: any, res: Response): void {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, company, role, is_anonymous FROM customers WHERE id = ?').get(req.user.userId) as any;

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
