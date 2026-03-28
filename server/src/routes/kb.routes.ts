import { Router } from 'express';
import { queryAll, queryOne } from '../db/connection';

const router = Router();

// Public KB endpoints — no auth required

// List all KB articles
router.get('/', async (_req, res) => {
  const articles = await queryAll<any>(`
    SELECT kb.*, p.name as product_name
    FROM knowledge_base kb
    LEFT JOIN products p ON kb.product_id = p.id
    ORDER BY kb.created_at DESC
    LIMIT 50
  `);
  res.json(articles);
});

// Search KB articles by title/content
router.get('/search', async (req, res) => {
  const q = (req.query.q as string) || '';
  const articles = await queryAll<any>(
    `SELECT kb.*, p.name as product_name
     FROM knowledge_base kb
     LEFT JOIN products p ON kb.product_id = p.id
     WHERE kb.title ILIKE ? OR kb.content ILIKE ?
     ORDER BY kb.created_at DESC
     LIMIT 20`,
    [`%${q}%`, `%${q}%`]
  );
  res.json(articles);
});

// Get single KB article
router.get('/:id', async (req, res) => {
  const article = await queryOne<any>(
    `SELECT kb.*, p.name as product_name
     FROM knowledge_base kb
     LEFT JOIN products p ON kb.product_id = p.id
     WHERE kb.id = ?`,
    [req.params.id]
  );
  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json(article);
});

export default router;
