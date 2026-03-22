"""Unit tests for Sprint 2: PPA Engine (LLM Execution + Judging).

Tests:
- test_select_tasks_quick: Quick mode selects 1 task (is_quick=True)
- test_select_tasks_full: Full mode selects up to 3 tasks
- test_get_task_brief_excludes_rubric: Brief does not include scoring_rubric
- test_execute_ppa_returns_output: Execute endpoint returns LLM output
- test_execute_ppa_max_attempts: Exceeding max attempts returns 400
- test_execute_ppa_timer_expired: Expired session returns 400
- test_execute_ppa_kba_required: PPA without KBA returns 400
- test_submit_best_returns_scores: Submit best returns 5-dimension scores
- test_submit_best_double_submit: Cannot judge same task twice
- test_attempt_tracking: Attempts stored in ppa_responses JSON
- test_compute_ppa_score: Weighted score calculation
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.assessment import Assessment, AssessmentMode, AssessmentStatus
from app.models.question import Task
from app.services.ppa_engine import (
    compute_ppa_score,
    get_attempt_count,
    get_max_attempts,
    get_task_brief,
    select_tasks,
    store_attempt,
)


# ============================================================
# Fixtures
# ============================================================


@pytest_asyncio.fixture
async def seeded_tasks(db_session):
    """Seed test database with sample PPA tasks."""
    tasks = []

    # Quick task
    t1 = Task(
        id=uuid.uuid4(),
        external_id="TASK-QUICK-001",
        title="Meeting Notes to Action Plan",
        pillar="P",
        pillars_tested=["P", "C", "A"],
        difficulty=2,
        brief="Extract action items from a meeting transcript.",
        input_data="Meeting transcript here...",
        success_criteria=["All action items identified", "JSON format"],
        scoring_rubric={
            "accuracy": {"weight": 0.30, "description": "Correct extraction"},
            "completeness": {"weight": 0.25, "description": "All items found"},
            "prompt_efficiency": {"weight": 0.20, "description": "Concise prompt"},
            "output_quality": {"weight": 0.15, "description": "Well formatted"},
            "creativity": {"weight": 0.10, "description": "Clever techniques"},
        },
        max_attempts=2,
        time_limit_seconds=480,
        is_quick=True,
        is_active=True,
    )
    db_session.add(t1)
    tasks.append(t1)

    # Full tasks
    for i, pillar in enumerate(["P", "C", "E"]):
        t = Task(
            id=uuid.uuid4(),
            external_id=f"TASK-{pillar}-{i:03d}",
            title=f"Task {pillar} {i}",
            pillar=pillar,
            pillars_tested=[pillar],
            difficulty=2,
            brief=f"Brief for task {pillar}-{i}",
            input_data=f"Input data for {pillar}-{i}",
            success_criteria=[f"Criteria for {pillar}-{i}"],
            scoring_rubric={
                "accuracy": {"weight": 0.30, "description": "Accuracy"},
                "completeness": {"weight": 0.25, "description": "Completeness"},
                "prompt_efficiency": {"weight": 0.20, "description": "Efficiency"},
                "output_quality": {"weight": 0.15, "description": "Quality"},
                "creativity": {"weight": 0.10, "description": "Creativity"},
            },
            max_attempts=3,
            time_limit_seconds=480,
            is_quick=False,
            is_active=True,
        )
        db_session.add(t)
        tasks.append(t)

    await db_session.commit()
    return tasks


@pytest_asyncio.fixture
async def seeded_all(db_session, seeded_db, seeded_tasks):
    """Seed both questions and tasks."""
    return {"questions": seeded_db, "tasks": seeded_tasks}


@pytest_asyncio.fixture
async def seeded_ppa_client(engine, seeded_all):
    """Test client with seeded questions and tasks."""
    from httpx import AsyncClient, ASGITransport
    from app.database import get_db
    from app.main import app

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


async def _start_and_submit_kba(client) -> str:
    """Helper: start assessment + submit KBA (all correct). Returns assessment_id."""
    start_res = await client.post("/assessments/start", json={"mode": "quick"})
    assert start_res.status_code == 200
    data = start_res.json()
    assessment_id = data["assessment_id"]
    questions = data["questions"]

    answers = [{"question_id": q["id"], "selected": 0} for q in questions]
    kba_res = await client.post(
        f"/assessments/{assessment_id}/kba/submit",
        json={"answers": answers},
    )
    assert kba_res.status_code == 200
    return assessment_id


# ============================================================
# Service-level tests (unit tests on ppa_engine functions)
# ============================================================


@pytest.mark.asyncio
async def test_select_tasks_quick(db_session, seeded_tasks):
    """Quick mode selects 1 task with is_quick=True."""
    tasks = await select_tasks(db_session, "quick")
    assert len(tasks) == 1
    assert tasks[0].is_quick is True


@pytest.mark.asyncio
async def test_select_tasks_full(db_session, seeded_tasks):
    """Full mode selects up to 3 tasks."""
    tasks = await select_tasks(db_session, "full")
    assert len(tasks) == 3


def test_get_task_brief_excludes_rubric():
    """Task brief does not include scoring_rubric."""

    class MockTask:
        id = uuid.uuid4()
        external_id = "TASK-001"
        title = "Test Task"
        pillar = "P"
        pillars_tested = ["P", "C"]
        difficulty = 2
        brief = "Brief text"
        input_data = "Input data"
        success_criteria = ["Criteria 1"]
        scoring_rubric = {"accuracy": {"weight": 0.3, "description": "Test"}}
        max_attempts = 3

    brief = get_task_brief(MockTask())
    assert "scoring_rubric" not in brief
    assert brief["title"] == "Test Task"
    assert brief["brief"] == "Brief text"
    assert brief["success_criteria"] == ["Criteria 1"]


def test_attempt_tracking():
    """Attempts are correctly stored and counted."""
    ppa = None

    # First attempt
    ppa = store_attempt(ppa, "task-1", "prompt 1", "output 1", 1)
    assert get_attempt_count(ppa, "task-1") == 1

    # Second attempt
    ppa = store_attempt(ppa, "task-1", "prompt 2", "output 2", 2)
    assert get_attempt_count(ppa, "task-1") == 2

    # Different task
    assert get_attempt_count(ppa, "task-2") == 0

    # Verify structure
    assert "task-1" in ppa["tasks"]
    assert len(ppa["tasks"]["task-1"]["attempts"]) == 2
    assert ppa["tasks"]["task-1"]["attempts"][0]["prompt"] == "prompt 1"
    assert ppa["tasks"]["task-1"]["attempts"][1]["output"] == "output 2"


def test_get_max_attempts():
    """Max attempts respects mode limits."""

    class MockTask:
        max_attempts = 5

    # Quick mode caps at 2
    assert get_max_attempts(MockTask(), "quick") == 2
    # Full mode uses task value
    assert get_max_attempts(MockTask(), "full") == 5


def test_compute_ppa_score():
    """Weighted PPA score calculation."""
    judge_result = {
        "accuracy": {"score": 80, "rationale": "Good"},
        "completeness": {"score": 90, "rationale": "Great"},
        "prompt_efficiency": {"score": 70, "rationale": "OK"},
        "output_quality": {"score": 85, "rationale": "Nice"},
        "creativity": {"score": 60, "rationale": "Decent"},
    }
    # 80*0.30 + 90*0.25 + 70*0.20 + 85*0.15 + 60*0.10
    # = 24 + 22.5 + 14 + 12.75 + 6 = 79.25
    score = compute_ppa_score(judge_result)
    assert score == 79.2  # rounds to 1 decimal


def test_compute_ppa_score_with_custom_rubric():
    """Custom rubric weights override defaults."""
    judge_result = {
        "accuracy": {"score": 100, "rationale": ""},
        "completeness": {"score": 0, "rationale": ""},
        "prompt_efficiency": {"score": 0, "rationale": ""},
        "output_quality": {"score": 0, "rationale": ""},
        "creativity": {"score": 0, "rationale": ""},
    }
    rubric = {
        "accuracy": {"weight": 1.0, "description": "All weight on accuracy"},
        "completeness": {"weight": 0.0, "description": ""},
        "prompt_efficiency": {"weight": 0.0, "description": ""},
        "output_quality": {"weight": 0.0, "description": ""},
        "creativity": {"weight": 0.0, "description": ""},
    }
    score = compute_ppa_score(judge_result, rubric)
    assert score == 100.0


# ============================================================
# API-level tests (integration tests via HTTP client)
# ============================================================

MOCK_LLM_OUTPUT = "Here are the action items:\n1. Fix the race condition\n2. Check currency formatting"

MOCK_JUDGE_RESULT = {
    "accuracy": {"score": 85, "rationale": "Good extraction"},
    "completeness": {"score": 90, "rationale": "All items found"},
    "prompt_efficiency": {"score": 75, "rationale": "Decent prompt"},
    "output_quality": {"score": 80, "rationale": "Well formatted"},
    "creativity": {"score": 70, "rationale": "Some techniques used"},
}


@pytest.mark.asyncio
async def test_get_ppa_tasks(seeded_ppa_client):
    """GET /assessments/{id}/ppa/tasks returns task briefs."""
    aid = await _start_and_submit_kba(seeded_ppa_client)

    res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    assert res.status_code == 200
    data = res.json()
    assert "tasks" in data
    assert len(data["tasks"]) >= 1

    # Verify no scoring rubric in response
    for task in data["tasks"]:
        assert "scoring_rubric" not in task
        assert "brief" in task
        assert "input_data" in task
        assert "success_criteria" in task


@pytest.mark.asyncio
async def test_get_ppa_tasks_requires_kba(seeded_ppa_client):
    """PPA tasks require KBA to be completed first."""
    start_res = await seeded_ppa_client.post("/assessments/start", json={"mode": "quick"})
    aid = start_res.json()["assessment_id"]

    res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    assert res.status_code == 400
    assert "kba" in res.json()["detail"].lower()


@pytest.mark.asyncio
@patch("app.services.ppa_engine.execute_prompt", new_callable=AsyncMock)
async def test_execute_ppa_returns_output(mock_execute, seeded_ppa_client):
    """POST /assessments/{id}/ppa/execute returns LLM output."""
    mock_execute.return_value = MOCK_LLM_OUTPUT

    aid = await _start_and_submit_kba(seeded_ppa_client)

    # Get tasks
    tasks_res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    task_id = tasks_res.json()["tasks"][0]["task_id"]

    # Execute
    res = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": task_id, "prompt": "Extract all action items as JSON"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["output"] == MOCK_LLM_OUTPUT
    assert data["attempt_number"] == 1
    assert data["attempts_used"] == 1
    assert data["max_attempts"] == 2  # quick mode


@pytest.mark.asyncio
@patch("app.services.ppa_engine.execute_prompt", new_callable=AsyncMock)
async def test_execute_ppa_max_attempts(mock_execute, seeded_ppa_client):
    """Exceeding max attempts returns 400."""
    mock_execute.return_value = MOCK_LLM_OUTPUT

    aid = await _start_and_submit_kba(seeded_ppa_client)

    tasks_res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    task_id = tasks_res.json()["tasks"][0]["task_id"]

    # Quick mode: max 2 attempts
    for i in range(2):
        res = await seeded_ppa_client.post(
            f"/assessments/{aid}/ppa/execute",
            json={"task_id": task_id, "prompt": f"Attempt {i+1}"},
        )
        assert res.status_code == 200

    # Third attempt should fail
    res = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": task_id, "prompt": "Too many attempts"},
    )
    assert res.status_code == 400
    assert "maximum attempts" in res.json()["detail"].lower()


@pytest.mark.asyncio
@patch("app.services.ppa_engine.execute_prompt", new_callable=AsyncMock)
async def test_execute_ppa_timer_expired(mock_execute, seeded_ppa_client, engine):
    """Expired session returns 400 on PPA execute."""
    mock_execute.return_value = MOCK_LLM_OUTPUT

    aid = await _start_and_submit_kba(seeded_ppa_client)

    tasks_res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    task_id = tasks_res.json()["tasks"][0]["task_id"]

    # Expire the assessment
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        result = await session.execute(
            select(Assessment).where(Assessment.id == uuid.UUID(aid))
        )
        assessment = result.scalar_one()
        assessment.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        await session.commit()

    res = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": task_id, "prompt": "Too late"},
    )
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


@pytest.mark.asyncio
@patch("app.services.ppa_engine.judge_output", new_callable=AsyncMock)
@patch("app.services.ppa_engine.execute_prompt", new_callable=AsyncMock)
async def test_submit_best_returns_scores(mock_execute, mock_judge, seeded_ppa_client):
    """Submit best attempt returns 5-dimension scores."""
    mock_execute.return_value = MOCK_LLM_OUTPUT
    mock_judge.return_value = MOCK_JUDGE_RESULT

    aid = await _start_and_submit_kba(seeded_ppa_client)

    tasks_res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    task_id = tasks_res.json()["tasks"][0]["task_id"]

    # Execute one attempt
    await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": task_id, "prompt": "Extract action items"},
    )

    # Submit best
    res = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/submit-best",
        json={"task_id": task_id, "attempt_index": 0},
    )
    assert res.status_code == 200
    data = res.json()
    assert "ppa_score" in data
    assert "dimensions" in data

    # Verify all 5 dimensions
    for dim in ["accuracy", "completeness", "prompt_efficiency", "output_quality", "creativity"]:
        assert dim in data["dimensions"]
        assert "score" in data["dimensions"][dim]
        assert "rationale" in data["dimensions"][dim]

    assert data["dimensions"]["accuracy"]["score"] == 85
    assert data["dimensions"]["completeness"]["score"] == 90


@pytest.mark.asyncio
@patch("app.services.ppa_engine.judge_output", new_callable=AsyncMock)
@patch("app.services.ppa_engine.execute_prompt", new_callable=AsyncMock)
async def test_submit_best_double_submit(mock_execute, mock_judge, seeded_ppa_client):
    """Cannot judge the same task twice."""
    mock_execute.return_value = MOCK_LLM_OUTPUT
    mock_judge.return_value = MOCK_JUDGE_RESULT

    aid = await _start_and_submit_kba(seeded_ppa_client)

    tasks_res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    task_id = tasks_res.json()["tasks"][0]["task_id"]

    # Execute
    await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": task_id, "prompt": "Extract action items"},
    )

    # First submit
    res1 = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/submit-best",
        json={"task_id": task_id, "attempt_index": 0},
    )
    assert res1.status_code == 200

    # Second submit
    res2 = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/submit-best",
        json={"task_id": task_id, "attempt_index": 0},
    )
    assert res2.status_code == 400
    assert "already been judged" in res2.json()["detail"].lower()


@pytest.mark.asyncio
@patch("app.services.ppa_engine.execute_prompt", new_callable=AsyncMock)
async def test_execute_ppa_invalid_task(mock_execute, seeded_ppa_client):
    """Execute with unassigned task returns 400."""
    mock_execute.return_value = MOCK_LLM_OUTPUT

    aid = await _start_and_submit_kba(seeded_ppa_client)

    # First call get tasks to initialize ppa_responses
    await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")

    # Use a random task ID
    fake_task_id = str(uuid.uuid4())
    res = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": fake_task_id, "prompt": "Test"},
    )
    assert res.status_code == 400
    assert "not assigned" in res.json()["detail"].lower()


@pytest.mark.asyncio
@patch("app.services.ppa_engine.execute_prompt", new_callable=AsyncMock)
async def test_attempt_tracking_via_api(mock_execute, seeded_ppa_client):
    """Multiple executions track attempts correctly."""
    mock_execute.return_value = MOCK_LLM_OUTPUT

    aid = await _start_and_submit_kba(seeded_ppa_client)

    tasks_res = await seeded_ppa_client.get(f"/assessments/{aid}/ppa/tasks")
    task_id = tasks_res.json()["tasks"][0]["task_id"]

    # First attempt
    res1 = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": task_id, "prompt": "First prompt"},
    )
    assert res1.status_code == 200
    assert res1.json()["attempt_number"] == 1
    assert res1.json()["attempts_used"] == 1

    # Second attempt
    res2 = await seeded_ppa_client.post(
        f"/assessments/{aid}/ppa/execute",
        json={"task_id": task_id, "prompt": "Second prompt"},
    )
    assert res2.status_code == 200
    assert res2.json()["attempt_number"] == 2
    assert res2.json()["attempts_used"] == 2
