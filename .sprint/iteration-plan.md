# PromptRanks PoC — Iteration Plan

**PRD Source**: PRD.md
**Created**: 2026-03-22
**Status**: Sprint 2 completed

## Sprint Overview

| Sprint | Name | Objective | Priority | Dependencies | Status |
|--------|------|-----------|----------|-------------|--------|
| 0 | Foundation | Project skeleton, Docker, CI, docs, content YAML | CRITICAL | None | Completed |
| 1 | Assessment Session + KBA Engine | User can start assessment and complete KBA questions | CRITICAL | Sprint 0 | Completed |
| 2 | PPA Engine | User can write prompts, execute them, get LLM-judged | CRITICAL | Sprint 1 | Completed |
| 3 | Scoring + Results + Anti-Cheat | Final score, level, results page, tab-lock | HIGH | Sprint 2 | Completed |
| 4 | Auth + Badge Claim | Register at claim time, badge generation, verification | HIGH | Sprint 3 | Completed |
| 5 | Polish + Release v0.1.0 | UX polish, error handling, rate limiting, release | MEDIUM | Sprint 4 | Pending |
| 6 | Content Registry Sync Client | Build registry client, license validation on startup, periodic content sync | HIGH | Sprint 5 | Pending |
| 7 | Content Tier Filtering | Filter assessment questions/tasks by user subscription tier and content_tier | HIGH | Sprint 6 | Pending |

---

## Sprint Details

### Sprint 0: Foundation (COMPLETED)

**Objective**: Project skeleton with Docker Compose, CI, docs, and sample content
**Priority**: CRITICAL
**Dependencies**: None
**PRD Sections**: Section 6 (Sprint 0)

#### Deliverables
- FastAPI app with `/health` endpoint
- React + Vite + TypeScript frontend with landing page
- Docker Compose (PostgreSQL 16 + Redis 7 + API + Web)
- PostgreSQL schema (users, questions, tasks, assessments, badges)
- 30 KBA questions (6 per PECAM pillar)
- 3 PPA tasks (1 quick, 2 full)
- CI pipeline (ruff, mypy, pytest, tsc, docker build)
- All docs (methodology, scoring, API, architecture, self-hosting, contributing-questions)
- Dual license: MIT + CC-BY-SA 4.0
- PRD document

#### Status: COMPLETED

---

### Sprint 1: Assessment Session + KBA Engine

**Objective**: User can start an assessment (no auth) and complete KBA questions with scoring
**Priority**: CRITICAL
**Dependencies**: Sprint 0
**PRD Sections**: 3.1 (Landing Page), 3.2.1 (KBA Phase), 4 (API — start, kba/submit), 5 (Assessment model), 6 (Sprint 1)

#### Task List

| ID | Task | Target Files | PRD Reference | Priority |
|----|------|-------------|---------------|----------|
| S1-T1 | Async SQLAlchemy database connection + session factory | `apps/api/app/database.py` | Section 5 | CRITICAL |
| S1-T2 | Wire up models with DB engine, create tables on startup | `apps/api/app/main.py`, models/ | Section 5 | CRITICAL |
| S1-T3 | Seed script: insert questions + tasks from YAML into DB | `scripts/seed-questions.py` | Section 6 Sprint 1 | HIGH |
| S1-T4 | `POST /assessments/start` — create session, select questions, return them | `apps/api/app/routers/assessment.py`, `apps/api/app/services/kba_engine.py` | Section 4, 3.1 | CRITICAL |
| S1-T5 | Question selection logic: Quick=10 (2/pillar), Full=20 (4/pillar) | `apps/api/app/services/kba_engine.py` | Section 6 Sprint 1 | HIGH |
| S1-T6 | `POST /assessments/{id}/kba/submit` — score answers, per-pillar breakdown | `apps/api/app/routers/assessment.py`, `apps/api/app/services/kba_engine.py` | Section 4 | CRITICAL |
| S1-T7 | Timer enforcement: set `expires_at` on start, reject late submissions | `apps/api/app/services/kba_engine.py` | Section 3.2 | HIGH |
| S1-T8 | Frontend: Landing page with mode selector + industry/role dropdowns | `apps/web/src/pages/Landing.tsx` | Section 3.1 | HIGH |
| S1-T9 | Frontend: KBA question cards, timer, progress indicator | `apps/web/src/pages/Assessment.tsx`, `apps/web/src/pages/KBA.tsx`, `apps/web/src/components/Timer.tsx` | Section 3.2.1 | HIGH |
| S1-T10 | Unit tests: start assessment, KBA scoring, pillar balance, timer expiry | `apps/api/tests/test_kba.py` | Section 6 Sprint 1 | CRITICAL |

#### Acceptance Criteria
- [x] `POST /assessments/start {mode: "quick"}` returns 10 questions (2 per pillar)
- [x] `POST /assessments/start {mode: "full"}` returns 20 questions (4 per pillar)
- [x] Questions response does NOT include correct answers
- [x] `POST /assessments/{id}/kba/submit` returns KBA score + per-pillar breakdown
- [x] Expired session returns 400 error
- [x] Seed script loads all 30 questions + 3 tasks into DB
- [x] Frontend: landing page starts assessment, KBA page shows questions with timer
- [x] All unit tests pass (21/21)
- [ ] CI green

#### Status: COMPLETED (2026-03-22)

---

### Sprint 2: PPA Engine (LLM Execution + Judging)

**Objective**: User can write prompts, execute them via Claude, and get LLM-judged scores
**Priority**: CRITICAL
**Dependencies**: Sprint 1
**PRD Sections**: 3.2.2 (PPA Phase), 4 (API — ppa/execute), 6 (Sprint 2)

#### Task List

| ID | Task | Target Files | PRD Reference | Priority |
|----|------|-------------|---------------|----------|
| S2-T1 | LLM client service (Anthropic SDK wrapper, token budgets) | `apps/api/app/services/llm_client.py` | Section 6 Sprint 2 | CRITICAL |
| S2-T2 | PPA task serving: load task from DB, return brief + input_data | `apps/api/app/routers/assessment.py` | Section 3.2.2 | HIGH |
| S2-T3 | `POST /assessments/{id}/ppa/execute` — run user prompt via Claude Sonnet | `apps/api/app/routers/assessment.py`, `apps/api/app/services/ppa_engine.py` | Section 4 | CRITICAL |
| S2-T4 | LLM judge service: score output with Claude Opus, 5-dimension rubric | `apps/api/app/services/ppa_engine.py` | Section 6 Sprint 2 | CRITICAL |
| S2-T5 | Attempt tracking: max 2 (quick) / 3 (full), best attempt selection | `apps/api/app/services/ppa_engine.py` | Section 3.2.2 | HIGH |
| S2-T6 | Frontend: PPA page with prompt editor, execute button, output panel | `apps/web/src/pages/PPA.tsx`, `apps/web/src/components/PromptEditor.tsx` | Section 3.2.2 | HIGH |
| S2-T7 | Unit tests (mocked LLM): execute, judge, attempts, consistency | `apps/api/tests/test_ppa.py` | Section 6 Sprint 2 | CRITICAL |

#### Acceptance Criteria
- [x] Execute prompt → LLM output returned within 15 seconds
- [x] Submit best attempt → judge returns 5-dimension scores as JSON
- [x] Attempt counter enforced (exceeding max returns 400)
- [x] Judge output has: accuracy, completeness, prompt_efficiency, output_quality, creativity
- [x] LLM tests use mocked responses (no real API calls in CI)
- [x] Frontend: editor + execute + output display works
- [x] All unit tests pass (37/37)
- [ ] CI green

#### Status: COMPLETED (2026-03-22)

---

### Sprint 3: Scoring + Results + Anti-Cheat

**Objective**: Complete assessment flow with final score, level assignment, results page, and anti-cheat
**Priority**: HIGH
**Dependencies**: Sprint 2
**PRD Sections**: 3.3 (Results Page), 3.2.3 (PSV Phase), 4 (API — results, violation, psv/submit), 6 (Sprint 3)

#### Task List

| ID | Task | Target Files | PRD Reference | Priority |
|----|------|-------------|---------------|----------|
| S3-T1 | Scoring service: Quick (KBA×0.40+PPA×0.60), Full (KBA×0.30+PPA×0.60+PSV×0.10) | `apps/api/app/services/scoring.py` | Section 6 Sprint 3 | CRITICAL |
| S3-T2 | Level assignment: L1(0-49), L2(50-69), L3(70-84), L4(85-94), L5(95-100) | `apps/api/app/services/scoring.py` | Section 6 Sprint 3 | CRITICAL |
| S3-T3 | PECAM pillar score aggregation | `apps/api/app/services/scoring.py` | Section 3.3 | HIGH |
| S3-T4 | `GET /assessments/{id}/results` — return full results | `apps/api/app/routers/assessment.py` | Section 4 | CRITICAL |
| S3-T5 | PSV portfolio submission + LLM judge scoring (full mode) | `apps/api/app/services/psv_engine.py`, `apps/api/app/routers/assessment.py` | Section 3.2.3 | HIGH |
| S3-T6 | Anti-cheat: `POST /assessments/{id}/violation`, 3 violations → void | `apps/api/app/routers/assessment.py`, `apps/api/app/middleware/anti_cheat.py` | Section 3.2 | HIGH |
| S3-T7 | Timer enforcement: backend rejects submissions after `expires_at` | `apps/api/app/middleware/anti_cheat.py` | Section 3.2 | HIGH |
| S3-T8 | Frontend: Results page with score, level, radar chart, pillar breakdown | `apps/web/src/pages/Results.tsx`, `apps/web/src/components/RadarChart.tsx` | Section 3.3 | HIGH |
| S3-T9 | Frontend: TabLock component (Page Visibility API) | `apps/web/src/components/TabLock.tsx`, `apps/web/src/hooks/useAntiCheat.ts` | Section 3.2 | HIGH |
| S3-T10 | Unit tests: scoring formulas, level boundaries, anti-cheat, timer | `apps/api/tests/test_scoring.py` | Section 6 Sprint 3 | CRITICAL |

#### Acceptance Criteria
- [ ] Quick assessment → final score = KBA×0.40 + PPA×0.60
- [ ] Full assessment → final score = KBA×0.30 + PPA×0.60 + PSV×0.10
- [ ] Level boundaries correct: 49→L1, 50→L2, 70→L3, 85→L4, 95→L5
- [ ] PECAM radar chart shows per-pillar scores
- [ ] Tab switch triggers warning overlay
- [ ] 3 violations → session voided (status = "voided")
- [ ] Late submission (after expires_at) returns 400
- [ ] PSV submission scored by LLM judge (full mode)
- [ ] All unit tests pass
- [ ] CI green

---

### Sprint 4: Auth + Badge Claim

**Objective**: Users register at claim time, badge generated with SVG and verification URL
**Priority**: HIGH
**Dependencies**: Sprint 3
**PRD Sections**: 3.3 (Claim section), 3.4 (Badge Page), 3.5 (Verification Page), 4 (API — auth, claim, verify), 6 (Sprint 4)

#### Task List

| ID | Task | Target Files | PRD Reference | Priority |
|----|------|-------------|---------------|----------|
| S4-T1 | `POST /auth/register` — email + password (bcrypt), return user | `apps/api/app/routers/auth.py`, `apps/api/app/services/auth_service.py` | Section 4 | CRITICAL |
| S4-T2 | `POST /auth/login` — verify password, return JWT | `apps/api/app/routers/auth.py`, `apps/api/app/services/auth_service.py` | Section 4 | CRITICAL |
| S4-T3 | JWT middleware for protected endpoints | `apps/api/app/middleware/auth.py` | Section 4 | HIGH |
| S4-T4 | `POST /assessments/{id}/claim` — register/login + link assessment + generate badge | `apps/api/app/routers/assessment.py` | Section 4 | CRITICAL |
| S4-T5 | Badge SVG generation: level, score, PECAM radar chart, date, mode label | `apps/api/app/services/badge_service.py` | Section 3.4 | HIGH |
| S4-T6 | `GET /badges/verify/{badge_id}` — public verification endpoint | `apps/api/app/routers/badges.py` | Section 3.5 | HIGH |
| S4-T7 | Frontend: Claim form on results page (email + password) | `apps/web/src/pages/Results.tsx` | Section 3.3 | HIGH |
| S4-T8 | Frontend: Badge page with share buttons (copy URL, download SVG) | `apps/web/src/pages/Badge.tsx`, `apps/web/src/components/BadgeCard.tsx` | Section 3.4 | HIGH |
| S4-T9 | Frontend: Verification page (public) | `apps/web/src/pages/Verify.tsx` | Section 3.5 | MEDIUM |
| S4-T10 | Unit tests: register, login, claim, verify, duplicate claim | `apps/api/tests/test_auth.py`, `apps/api/tests/test_badge.py` | Section 6 Sprint 4 | CRITICAL |

#### Acceptance Criteria
- [x] Complete assessment → click Claim → register → badge issued
- [x] Badge SVG contains: level, score, radar chart, date, "Estimated"/"Certified"
- [x] `GET /badges/verify/{id}` returns badge data (public, no auth)
- [x] Already registered user can login and claim
- [x] Can't claim same assessment twice (409 error)
- [x] Passwords hashed with bcrypt
- [x] JWT tokens work for protected endpoints
- [x] All unit tests pass
- [x] CI green

#### Status: COMPLETED (2026-03-25)

---

### Sprint 5: Polish + Release v0.1.0

**Objective**: Production-ready PoC with polished UX, error handling, and first GitHub release
**Priority**: MEDIUM
**Dependencies**: Sprint 4
**PRD Sections**: 6 (Sprint 5), 7 (Non-Functional), 9 (Success Metrics)

#### Task List

| ID | Task | Target Files | PRD Reference | Priority |
|----|------|-------------|---------------|----------|
| S5-T1 | Landing page polish: responsive, PECAM icons, "How it works" section | `apps/web/src/pages/Landing.tsx` | Section 3.1 | HIGH |
| S5-T2 | Assessment UX: transitions between KBA→PPA→PSV, loading states | `apps/web/src/pages/Assessment.tsx` | Section 3.2 | HIGH |
| S5-T3 | Results page: animated score reveal, radar chart animation | `apps/web/src/pages/Results.tsx` | Section 3.3 | MEDIUM |
| S5-T4 | Quick → Full conversion CTA on results page | `apps/web/src/pages/Results.tsx` | Section 3.3 | MEDIUM |
| S5-T5 | Error handling: network errors, LLM failures, timeout recovery | All frontend pages | Section 7 | HIGH |
| S5-T6 | Rate limiting (Redis-based) on assessment + LLM endpoints | `apps/api/app/middleware/rate_limit.py` | Section 7 | HIGH |
| S5-T7 | Update README with screenshots | `README.md` | — | MEDIUM |
| S5-T8 | Update CHANGELOG for v0.1.0 | `CHANGELOG.md` | — | MEDIUM |
| S5-T9 | Tag v0.1.0, create GitHub Release | — | — | HIGH |
| S5-T10 | Create 5 "good first issues" for community | GitHub Issues | — | MEDIUM |

#### Acceptance Criteria
- [ ] Quick Assessment flow works end-to-end in under 15 min
- [ ] Full Assessment flow works end-to-end in under 60 min
- [ ] All pages responsive (mobile + desktop, tablet for assessment)
- [ ] Error states handled gracefully (no blank screens)
- [ ] Rate limiting prevents abuse (429 on excess)
- [ ] README has screenshots and clear quickstart
- [ ] CHANGELOG updated
- [ ] GitHub Release v0.1.0 published
- [ ] 5 "good first issues" created
- [ ] CI green, all tests pass
