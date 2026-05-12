-- One-shot: clone categories + questions from ProSBC into Tmedia Gateways and Tsig Gateways.
--
-- Safe to re-run: each target is skipped if it already has at least one
-- non-deleted category, so this won't create duplicates.
--
-- Edit SOURCE_NAME / TARGETS below if your product names differ.
--
-- Run from the repo root on the server:
--   docker compose exec -T postgres psql -U ticketuser -d tickets \
--       < scripts/clone-prosbc-categories.sql

DO $$
DECLARE
  source_name CONSTANT TEXT   := 'ProSBC';
  targets     CONSTANT TEXT[] := ARRAY['Tmedia Gateways', 'Tsig Gateways'];

  src_id      INT;
  tgt_id      INT;
  tgt_name    TEXT;
  cat_rec     RECORD;
  q_rec       RECORD;
  new_cat_id  INT;
  new_q_id    INT;
  cat_count   INT;
  q_count     INT;
BEGIN
  SELECT id INTO src_id
  FROM products
  WHERE name = source_name AND deleted_at IS NULL
  LIMIT 1;

  IF src_id IS NULL THEN
    RAISE EXCEPTION 'Source product "%" not found', source_name;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS q_map (old_id INT PRIMARY KEY, new_id INT NOT NULL);

  FOREACH tgt_name IN ARRAY targets LOOP
    SELECT id INTO tgt_id
    FROM products
    WHERE name = tgt_name AND deleted_at IS NULL
    LIMIT 1;

    IF tgt_id IS NULL THEN
      RAISE NOTICE 'Skipping "%" — product not found', tgt_name;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM product_categories
      WHERE product_id = tgt_id AND deleted_at IS NULL
    ) THEN
      RAISE NOTICE 'Skipping "%" — already has categories', tgt_name;
      CONTINUE;
    END IF;

    DELETE FROM q_map;
    cat_count := 0;
    q_count   := 0;

    -- Clone each ProSBC category and its questions (conditional_on left NULL for now)
    FOR cat_rec IN
      SELECT * FROM product_categories
      WHERE product_id = src_id AND deleted_at IS NULL
      ORDER BY display_order, id
    LOOP
      INSERT INTO product_categories (product_id, name, description, icon, display_order)
      VALUES (tgt_id, cat_rec.name, cat_rec.description, cat_rec.icon, cat_rec.display_order)
      RETURNING id INTO new_cat_id;

      cat_count := cat_count + 1;

      FOR q_rec IN
        SELECT * FROM question_templates
        WHERE category_id = cat_rec.id AND deleted_at IS NULL
        ORDER BY display_order, id
      LOOP
        INSERT INTO question_templates (
          category_id, question_text, question_type, options, is_required,
          display_order, conditional_on, conditional_value, placeholder, validation_rules
        ) VALUES (
          new_cat_id, q_rec.question_text, q_rec.question_type, q_rec.options, q_rec.is_required,
          q_rec.display_order, NULL, q_rec.conditional_value, q_rec.placeholder, q_rec.validation_rules
        )
        RETURNING id INTO new_q_id;

        INSERT INTO q_map(old_id, new_id) VALUES (q_rec.id, new_q_id);
        q_count := q_count + 1;
      END LOOP;
    END LOOP;

    -- Second pass: remap conditional_on within the cloned questions
    UPDATE question_templates qt_new
    SET    conditional_on = m_dep.new_id
    FROM   q_map m_self
    JOIN   question_templates qt_old
           ON qt_old.id = m_self.old_id
          AND qt_old.conditional_on IS NOT NULL
    JOIN   q_map m_dep
           ON m_dep.old_id = qt_old.conditional_on
    WHERE  qt_new.id = m_self.new_id;

    RAISE NOTICE 'Cloned ProSBC -> "%": % categories, % questions', tgt_name, cat_count, q_count;
  END LOOP;

  DROP TABLE IF EXISTS q_map;
END $$;
