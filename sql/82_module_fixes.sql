-- ============================================================
-- Module fixes — make generated documents standalone-friendly
-- Migration: sql/82_module_fixes.sql
-- ============================================================
BEGIN;

-- Certificates: generated documents may be created directly for a
-- student without a pre-existing request/template/uploaded file.
ALTER TABLE school_generated_document ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE school_generated_document ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE school_generated_document ALTER COLUMN file_id DROP NOT NULL;

ALTER TABLE school_generated_document ADD COLUMN IF NOT EXISTS student_id INT REFERENCES school_students(id) ON DELETE SET NULL;
ALTER TABLE school_generated_document ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE school_generated_document ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE school_generated_document ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_gen_doc_student ON school_generated_document(app_id, student_id);

-- ID cards: allow issuing without an explicit academic session (resolved by app).
ALTER TABLE school_id_card ALTER COLUMN session_id DROP NOT NULL;

COMMIT;
