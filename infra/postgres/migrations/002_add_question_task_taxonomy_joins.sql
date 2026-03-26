-- Migration 002: Add many-to-many join tables for Question/Task ↔ Industry/Role
-- Enables domain-specific question selection based on user's industry/role.
-- Safe to re-run (uses IF NOT EXISTS).
-- Date: 2026-03-26

-- Question ↔ Industry (many-to-many)
CREATE TABLE IF NOT EXISTS question_industries (
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, industry_id)
);
CREATE INDEX IF NOT EXISTS idx_qi_industry ON question_industries(industry_id);

-- Question ↔ Role (many-to-many)
CREATE TABLE IF NOT EXISTS question_roles (
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_qr_role ON question_roles(role_id);

-- Task ↔ Industry (many-to-many)
CREATE TABLE IF NOT EXISTS task_industries (
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, industry_id)
);
CREATE INDEX IF NOT EXISTS idx_ti_industry ON task_industries(industry_id);

-- Task ↔ Role (many-to-many)
CREATE TABLE IF NOT EXISTS task_roles (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_tr_role ON task_roles(role_id);
