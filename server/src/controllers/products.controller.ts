import { Request, Response } from 'express';
import { getDb } from '../db/connection';

export function getProducts(_req: Request, res: Response): void {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  res.json(products);
}

export function getCategories(req: Request, res: Response): void {
  const db = getDb();
  const { productId } = req.params;
  const categories = db.prepare(
    'SELECT * FROM product_categories WHERE product_id = ? ORDER BY display_order'
  ).all(productId);
  res.json(categories);
}

export function getQuestions(req: Request, res: Response): void {
  const db = getDb();
  const { categoryId } = req.params;
  const questions = db.prepare(
    'SELECT * FROM question_templates WHERE category_id = ? ORDER BY display_order'
  ).all(categoryId);

  // Parse JSON fields
  const parsed = questions.map((q: any) => ({
    id: q.id,
    categoryId: q.category_id,
    questionText: q.question_text,
    questionType: q.question_type,
    options: q.options ? JSON.parse(q.options) : null,
    isRequired: !!q.is_required,
    displayOrder: q.display_order,
    conditionalOn: q.conditional_on,
    conditionalValue: q.conditional_value,
    placeholder: q.placeholder,
    validationRules: q.validation_rules ? JSON.parse(q.validation_rules) : null,
  }));

  res.json(parsed);
}
