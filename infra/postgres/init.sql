-- PromptRanks PoC — Database Schema
-- Applied automatically on first docker compose up

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    subscription_tier VARCHAR(50) DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Packs
CREATE TABLE IF NOT EXISTS content_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    tier_required VARCHAR(50) NOT NULL DEFAULT 'free'
        CHECK (tier_required IN ('free', 'pro', 'enterprise')),
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    published_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions (KBA)
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(20) UNIQUE NOT NULL,
    pillar CHAR(1) NOT NULL CHECK (pillar IN ('P', 'E', 'C', 'M', 'A')),
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    question_type VARCHAR(20) NOT NULL DEFAULT 'mcq',
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer JSONB NOT NULL,
    explanation TEXT,
    tags JSONB,
    content_tier VARCHAR(20) NOT NULL DEFAULT 'core'
        CHECK (content_tier IN ('core', 'premium', 'enterprise', 'local')),
    content_pack_id UUID REFERENCES content_packs(id),
    source VARCHAR(20) NOT NULL DEFAULT 'seed'
        CHECK (source IN ('seed', 'registry', 'manual', 'import')),
    usage_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_pillar ON questions(pillar);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_content_tier ON questions(content_tier);
CREATE INDEX idx_questions_content_pack ON questions(content_pack_id);

-- Tasks (PPA)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    pillar CHAR(1) NOT NULL CHECK (pillar IN ('P', 'E', 'C', 'M', 'A')),
    pillars_tested JSONB,
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    brief TEXT NOT NULL,
    input_data TEXT,
    success_criteria JSONB NOT NULL,
    scoring_rubric JSONB,
    max_attempts INTEGER DEFAULT 3,
    time_limit_seconds INTEGER DEFAULT 480,
    is_quick BOOLEAN DEFAULT FALSE,
    content_tier VARCHAR(20) NOT NULL DEFAULT 'core'
        CHECK (content_tier IN ('core', 'premium', 'enterprise', 'local')),
    content_pack_id UUID REFERENCES content_packs(id),
    source VARCHAR(20) NOT NULL DEFAULT 'seed'
        CHECK (source IN ('seed', 'registry', 'manual', 'import')),
    usage_count INTEGER DEFAULT 0,
    avg_score FLOAT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_content_tier ON tasks(content_tier);
CREATE INDEX idx_tasks_content_pack ON tasks(content_pack_id);

-- Industries
CREATE TABLE IF NOT EXISTS industries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    parent_id UUID REFERENCES industries(id),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_industries_parent ON industries(parent_id);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    industry_id UUID REFERENCES industries(id),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, industry_id)
);

CREATE INDEX idx_roles_industry ON roles(industry_id);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('quick', 'full')),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'voided', 'expired')),
    industry VARCHAR(100),
    role VARCHAR(100),
    industry_id UUID REFERENCES industries(id),
    role_id UUID REFERENCES roles(id),
    kba_score FLOAT,
    kba_responses JSONB,
    ppa_score FLOAT,
    ppa_responses JSONB,
    psv_score FLOAT,
    psv_submission JSONB,
    final_score FLOAT,
    level INTEGER CHECK (level BETWEEN 1 AND 5),
    pillar_scores JSONB,
    violations INTEGER DEFAULT 0,
    violation_log JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_user ON assessments(user_id);
CREATE INDEX idx_assessments_status ON assessments(status);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id),
    mode VARCHAR(10) NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
    level_name VARCHAR(20) NOT NULL,
    final_score FLOAT NOT NULL,
    pillar_scores JSONB NOT NULL,
    badge_svg TEXT,
    verification_url VARCHAR(255),
    issuer_domain VARCHAR(255),
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_badges_user ON badges(user_id);
