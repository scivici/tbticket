import { Request, Response } from 'express';
import { query, queryOne, queryAll, transaction, clientQuery } from '../db/connection';

export async function listQuestions(req: Request, res: Response): Promise<void> {
  const { categoryId } = req.params;

  const questions = await queryAll<any>(
    'SELECT * FROM question_templates WHERE category_id = ? ORDER BY display_order',
    [categoryId]
  );

  res.json(questions);
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  const {
    categoryId, questionText, questionType, options, isRequired,
    displayOrder, conditionalOn, conditionalValue, placeholder, validationRules,
  } = req.body;

  if (!categoryId || !questionText || !questionType) {
    res.status(400).json({ error: 'categoryId, questionText, and questionType are required' });
    return;
  }

  const result = await query(`
    INSERT INTO question_templates
    (category_id, question_text, question_type, options, is_required, display_order,
     conditional_on, conditional_value, placeholder, validation_rules)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [
    categoryId,
    questionText,
    questionType,
    options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
    isRequired ? true : false,
    displayOrder || 0,
    conditionalOn || null,
    conditionalValue || null,
    placeholder || null,
    validationRules ? (typeof validationRules === 'string' ? validationRules : JSON.stringify(validationRules)) : null,
  ]);

  res.status(201).json({ id: result.rows[0].id, message: 'Question created' });
}

export async function updateQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    questionText, questionType, options, isRequired,
    displayOrder, conditionalOn, conditionalValue, placeholder, validationRules,
  } = req.body;

  const existing = await queryOne<any>('SELECT id FROM question_templates WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  await query(`
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
  `, [
    questionText,
    questionType,
    options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
    isRequired !== undefined ? (isRequired ? true : false) : null,
    displayOrder,
    conditionalOn,
    conditionalValue,
    placeholder,
    validationRules ? (typeof validationRules === 'string' ? validationRules : JSON.stringify(validationRules)) : null,
    id,
  ]);

  res.json({ message: 'Question updated' });
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const existing = await queryOne<any>('SELECT id FROM question_templates WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  const answerRef = await queryOne<any>('SELECT id FROM ticket_answers WHERE question_template_id = ? LIMIT 1', [id]);
  if (answerRef) {
    res.status(409).json({ error: 'Cannot delete question: existing ticket answers reference it. This question was already used in submitted tickets.' });
    return;
  }

  await query('UPDATE question_templates SET conditional_on = NULL, conditional_value = NULL WHERE conditional_on = ?', [id]);

  await query('DELETE FROM question_templates WHERE id = ?', [id]);
  res.json({ message: 'Question deleted' });
}

export async function reorderQuestions(req: Request, res: Response): Promise<void> {
  const items = req.body.items || req.body.questions;

  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  await transaction(async (client) => {
    for (const q of items) {
      await clientQuery(client, 'UPDATE question_templates SET display_order = ? WHERE id = ?', [q.displayOrder, q.id]);
    }
  });

  res.json({ message: 'Questions reordered' });
}
