import { Request, Response } from 'express';
import { queryAll } from '../db/connection';

export async function getProducts(_req: Request, res: Response): Promise<void> {
  const products = await queryAll<any>('SELECT * FROM products ORDER BY id');
  res.json(products);
}

export async function getCategories(req: Request, res: Response): Promise<void> {
  const { productId } = req.params;
  const categories = await queryAll<any>(
    'SELECT * FROM product_categories WHERE product_id = ? ORDER BY display_order',
    [productId]
  );
  res.json(categories);
}

export async function getQuestions(req: Request, res: Response): Promise<void> {
  const { categoryId } = req.params;
  const questions = await queryAll<any>(
    'SELECT * FROM question_templates WHERE category_id = ? ORDER BY display_order',
    [categoryId]
  );

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
