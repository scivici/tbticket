import { Request, Response } from 'express';
import { getDb } from '../db/connection';

export function listQuestions(req: Request, res: Response): void {
  const db = getDb();
  const { categoryId } = req.params;

  const questions = db.prepare(
    'SELECT * FROM question_templates WHERE category_id = ? ORDER BY display_order'
  ).all(categoryId);

  res.json(questions);
}

export function createQuestion(req: Request, res: Response): void {
  const db = getDb();
  const {
    categoryId, questionText, questionType, options, isRequired,
    displayOrder, conditionalOn, conditionalValue, placeholder, validationRules,
  } = req.body;

  if (!categoryId || !questionText || !questionType) {
    res.status(400).json({ error: 'categoryId, questionText, and questionType are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO question_templates
    (category_id, question_text, question_type, options, is_required, display_order,
     conditional_on, conditional_value, placeholder, validation_rules)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    categoryId,
    questionText,
    questionType,
    options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
    isRequired ? 1 : 0,
    displayOrder || 0,
    conditionalOn || null,
    conditionalValue || null,
    placeholder || null,
    validationRules ? (typeof validationRules === 'string' ? validationRules : JSON.stringify(validationRules)) : null,
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Question created' });
}

export function updateQuestion(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;
  const {
    questionText, questionType, options, isRequired,
    displayOrder, conditionalOn, conditionalValue, placeholder, validationRules,
  } = req.body;

  const existing = db.prepare('SELECT id FROM question_templates WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  db.prepare(`
    UPDATE question_templates SET
    question_text = COALESCE(?, question_text),
    question_type = COALESCE(?, question_type),
    options = COALESCE(?, options),
    is_required = COALESCE(?, is_required),
    display_order = COALESCE(?, display_order),
    conditional_on = COALESCE(?, conditional_on),
    conditional_value = COALESCE(?, conditional_value),
    placeholder = COALESCE(?, placeholder),
    validation_rules = COALESCE(?, validation_rules)
    WHERE id = ?
  `).run(
    questionText,
    questionType,
    options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
    isRequired !== undefined ? (isRequired ? 1 : 0) : null,
    displayOrder,
    conditionalOn,
    conditionalValue,
    placeholder,
    validationRules ? (typeof validationRules === 'string' ? validationRules : JSON.stringify(validationRules)) : null,
    id,
  );

  res.json({ message: 'Question updated' });
}

export function deleteQuestion(req: Request, res: Response): void {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM question_templates WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  const answerRef = db.prepare('SELECT id FROM ticket_answers WHERE question_template_id = ? LIMIT 1').get(id) as any;
  if (answerRef) {
    res.status(409).json({ error: 'Cannot delete question: ticket answers reference it' });
    return;
  }

  db.prepare('DELETE FROM question_templates WHERE id = ?').run(id);
  res.json({ message: 'Question deleted' });
}

export function reorderQuestions(req: Request, res: Response): void {
  const db = getDb();
  const items = req.body.items || req.body.questions;

  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  db.transaction(() => {
    const stmt = db.prepare('UPDATE question_templates SET display_order = ? WHERE id = ?');
    for (const q of items) {
      stmt.run(q.displayOrder, q.id);
    }
  })();

  res.json({ message: 'Questions reordered' });
}
