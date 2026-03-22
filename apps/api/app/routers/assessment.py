"""Assessment router: start, KBA submit, PPA execute, PSV submit, results."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.config import settings
from app.database import get_db
from app.models.assessment import Assessment, AssessmentMode, AssessmentStatus
from app.models.question import Question, Task
from app.services.kba_engine import (
    check_timer_expired,
    expire_assessment,
    score_kba,
    select_questions,
)
from app.services.ppa_engine import (
    compute_ppa_score,
    execute_task_prompt,
    get_attempt_count,
    get_max_attempts,
    get_task_brief,
    judge_task_output,
    select_tasks,
    store_attempt,
)

router = APIRouter(prefix="/assessments", tags=["assessments"])


# --- Request/Response schemas ---


class StartAssessmentRequest(BaseModel):
    mode: str  # "quick" or "full"
    industry: str | None = None
    role: str | None = None


class QuestionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    text: str
    options: list[str]
    pillar: str


class StartAssessmentResponse(BaseModel):
    assessment_id: str
    mode: str
    expires_at: str
    questions: list[QuestionOut]


class KBAAnswer(BaseModel):
    question_id: str
    selected: int


class SubmitKBARequest(BaseModel):
    answers: list[KBAAnswer]


class PillarScoreOut(BaseModel):
    score: float
    correct: int
    total: int


class SubmitKBAResponse(BaseModel):
    kba_score: float
    total_correct: int
    total_questions: int
    pillar_scores: dict[str, PillarScoreOut]


class PPAExecuteRequest(BaseModel):
    task_id: str
    prompt: str


class PPAExecuteResponse(BaseModel):
    task_id: str
    attempt_number: int
    output: str
    attempts_used: int
    max_attempts: int


class PPASubmitBestRequest(BaseModel):
    task_id: str
    attempt_index: int  # 0-based index of the best attempt


class DimensionScore(BaseModel):
    score: int
    rationale: str


class PPASubmitBestResponse(BaseModel):
    task_id: str
    ppa_score: float
    dimensions: dict[str, DimensionScore]


class PPATasksResponse(BaseModel):
    tasks: list[dict[str, Any]]


# --- Endpoints ---


@router.post("/start", response_model=StartAssessmentResponse)
async def start_assessment(
    body: StartAssessmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start a new assessment (quick or full). No auth required."""
    if body.mode not in ("quick", "full"):
        raise HTTPException(status_code=400, detail="mode must be 'quick' or 'full'")

    # Select questions
    questions = await select_questions(db, body.mode)
    if not questions:
        raise HTTPException(status_code=500, detail="No questions available. Run the seed script first.")

    # Calculate expiry
    if body.mode == "quick":
        time_limit = settings.quick_assessment_time_limit
    else:
        time_limit = settings.full_kba_time_limit

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=time_limit)

    # Create assessment
    assessment = Assessment(
        id=uuid.uuid4(),
        mode=AssessmentMode(body.mode),
        status=AssessmentStatus.in_progress,
        industry=body.industry,
        role=body.role,
        started_at=now,
        expires_at=expires_at,
        kba_responses={"question_ids": [str(q.id) for q in questions]},
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)

    # Return questions WITHOUT correct_answer or explanation
    questions_out = [
        QuestionOut(
            id=str(q.id),
            text=q.question_text,
            options=q.options,
            pillar=q.pillar,
        )
        for q in questions
    ]

    return StartAssessmentResponse(
        assessment_id=str(assessment.id),
        mode=body.mode,
        expires_at=expires_at.isoformat(),
        questions=questions_out,
    )


@router.post("/{assessment_id}/kba/submit", response_model=SubmitKBAResponse)
async def submit_kba(
    assessment_id: str,
    body: SubmitKBARequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit KBA answers. Returns score + per-pillar breakdown."""
    # Load assessment
    try:
        aid = uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assessment ID")

    result = await db.execute(select(Assessment).where(Assessment.id == aid))
    assessment = result.scalar_one_or_none()

    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment.status == AssessmentStatus.expired:
        raise HTTPException(status_code=400, detail="Assessment has expired")

    if assessment.status == AssessmentStatus.voided:
        raise HTTPException(status_code=400, detail="Assessment has been voided")

    if assessment.kba_score is not None:
        raise HTTPException(status_code=400, detail="KBA already submitted for this assessment")

    # Check timer
    if check_timer_expired(assessment):
        await expire_assessment(db, assessment)
        raise HTTPException(status_code=400, detail="Assessment has expired")

    # Load the questions that were assigned to this assessment
    question_ids_str = assessment.kba_responses.get("question_ids", []) if assessment.kba_responses else []
    question_ids = [uuid.UUID(qid) for qid in question_ids_str]

    result = await db.execute(select(Question).where(Question.id.in_(question_ids)))
    questions = result.scalars().all()
    questions_by_id = {str(q.id): q for q in questions}

    # Score
    answers_dicts = [{"question_id": a.question_id, "selected": a.selected} for a in body.answers]
    kba_result = score_kba(answers_dicts, questions_by_id)

    # Update assessment
    assessment.kba_score = kba_result["total_score"]
    assessment.kba_responses = {
        "question_ids": question_ids_str,
        "answers": [a.model_dump() for a in body.answers],
    }
    assessment.pillar_scores = kba_result["pillar_scores"]
    await db.commit()

    return SubmitKBAResponse(
        kba_score=kba_result["total_score"],
        total_correct=kba_result["total_correct"],
        total_questions=kba_result["total_questions"],
        pillar_scores={
            p: PillarScoreOut(**data) for p, data in kba_result["pillar_scores"].items()
        },
    )


# --- Helper to load + validate assessment ---


async def _load_assessment(db: AsyncSession, assessment_id: str) -> Assessment:
    """Load an in-progress, non-expired assessment or raise HTTPException."""
    try:
        aid = uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assessment ID")

    result = await db.execute(select(Assessment).where(Assessment.id == aid))
    assessment = result.scalar_one_or_none()

    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.status == AssessmentStatus.expired:
        raise HTTPException(status_code=400, detail="Assessment has expired")
    if assessment.status == AssessmentStatus.voided:
        raise HTTPException(status_code=400, detail="Assessment has been voided")
    if assessment.status == AssessmentStatus.completed:
        raise HTTPException(status_code=400, detail="Assessment already completed")
    if check_timer_expired(assessment):
        await expire_assessment(db, assessment)
        raise HTTPException(status_code=400, detail="Assessment has expired")

    return assessment


# --- PPA Endpoints ---


@router.get("/{assessment_id}/ppa/tasks", response_model=PPATasksResponse)
async def get_ppa_tasks(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get PPA tasks for the assessment. Selects tasks on first call, returns cached on subsequent calls."""
    assessment = await _load_assessment(db, assessment_id)

    # Check KBA is done
    if assessment.kba_score is None:
        raise HTTPException(status_code=400, detail="KBA must be completed before PPA")

    # Check if tasks already assigned
    ppa = assessment.ppa_responses or {}
    task_ids_str = ppa.get("task_ids", [])

    if not task_ids_str:
        # Select tasks
        tasks = await select_tasks(db, assessment.mode.value)
        if not tasks:
            raise HTTPException(status_code=500, detail="No PPA tasks available. Run the seed script.")

        task_ids_str = [str(t.id) for t in tasks]
        assessment.ppa_responses = {
            "task_ids": task_ids_str,
            "tasks": {},
        }
        flag_modified(assessment, "ppa_responses")
        await db.commit()
    else:
        # Load tasks from DB
        task_ids = [uuid.UUID(tid) for tid in task_ids_str]
        result = await db.execute(select(Task).where(Task.id.in_(task_ids)))
        tasks = list(result.scalars().all())

    # Return briefs (without scoring rubric)
    briefs = [get_task_brief(t) for t in tasks]
    return PPATasksResponse(tasks=briefs)


@router.post("/{assessment_id}/ppa/execute", response_model=PPAExecuteResponse)
async def execute_ppa(
    assessment_id: str,
    body: PPAExecuteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute a user prompt against a PPA task. Returns LLM output (not judge scores)."""
    assessment = await _load_assessment(db, assessment_id)

    if assessment.kba_score is None:
        raise HTTPException(status_code=400, detail="KBA must be completed before PPA")

    # Validate task is assigned to this assessment
    ppa = assessment.ppa_responses or {}
    task_ids_str = ppa.get("task_ids", [])
    if body.task_id not in task_ids_str:
        raise HTTPException(status_code=400, detail="Task not assigned to this assessment")

    # Load task from DB
    try:
        task_uuid = uuid.UUID(body.task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    result = await db.execute(select(Task).where(Task.id == task_uuid))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check max attempts
    max_att = get_max_attempts(task, assessment.mode.value)
    current_attempts = get_attempt_count(ppa, body.task_id)

    if current_attempts >= max_att:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum attempts ({max_att}) reached for this task",
        )

    # Execute prompt via LLM
    try:
        output = await execute_task_prompt(body.prompt, task)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM execution failed: {str(e)}")

    # Store attempt
    attempt_number = current_attempts + 1
    updated_ppa = store_attempt(
        ppa_responses=ppa,
        task_id=body.task_id,
        prompt=body.prompt,
        output=output,
        attempt_number=attempt_number,
    )
    assessment.ppa_responses = updated_ppa
    flag_modified(assessment, "ppa_responses")
    await db.commit()

    return PPAExecuteResponse(
        task_id=body.task_id,
        attempt_number=attempt_number,
        output=output,
        attempts_used=attempt_number,
        max_attempts=max_att,
    )


@router.post("/{assessment_id}/ppa/submit-best", response_model=PPASubmitBestResponse)
async def submit_best_attempt(
    assessment_id: str,
    body: PPASubmitBestRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit best attempt for judging. Returns 5-dimension scores."""
    assessment = await _load_assessment(db, assessment_id)

    ppa = assessment.ppa_responses or {}
    task_ids_str = ppa.get("task_ids", [])
    if body.task_id not in task_ids_str:
        raise HTTPException(status_code=400, detail="Task not assigned to this assessment")

    # Get task data
    task_data = ppa.get("tasks", {}).get(body.task_id)
    if not task_data or not task_data.get("attempts"):
        raise HTTPException(status_code=400, detail="No attempts found for this task")

    attempts = task_data["attempts"]
    if body.attempt_index < 0 or body.attempt_index >= len(attempts):
        raise HTTPException(status_code=400, detail="Invalid attempt index")

    # Check not already judged
    if task_data.get("judge_result") is not None:
        raise HTTPException(status_code=400, detail="This task has already been judged")

    # Load task from DB
    try:
        task_uuid = uuid.UUID(body.task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    result = await db.execute(select(Task).where(Task.id == task_uuid))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get the selected attempt
    best_attempt = attempts[body.attempt_index]

    # Judge the output
    try:
        judge_result = await judge_task_output(
            task=task,
            user_prompt=best_attempt["prompt"],
            llm_output=best_attempt["output"],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM judging failed: {str(e)}")

    # Compute weighted score
    ppa_score = compute_ppa_score(judge_result, task.scoring_rubric)

    # Store judge result
    task_data["selected_best"] = body.attempt_index
    task_data["judge_result"] = judge_result
    task_data["ppa_score"] = ppa_score
    ppa["tasks"][body.task_id] = task_data

    # Check if all tasks are judged — compute overall PPA score
    all_judged = all(
        ppa.get("tasks", {}).get(tid, {}).get("judge_result") is not None
        for tid in task_ids_str
    )
    if all_judged:
        # Average PPA scores across all tasks
        task_scores = [
            ppa["tasks"][tid]["ppa_score"]
            for tid in task_ids_str
            if "ppa_score" in ppa["tasks"].get(tid, {})
        ]
        if task_scores:
            assessment.ppa_score = round(sum(task_scores) / len(task_scores), 1)

    assessment.ppa_responses = ppa
    flag_modified(assessment, "ppa_responses")
    await db.commit()

    return PPASubmitBestResponse(
        task_id=body.task_id,
        ppa_score=ppa_score,
        dimensions={
            dim: DimensionScore(
                score=data["score"],
                rationale=data.get("rationale", ""),
            )
            for dim, data in judge_result.items()
        },
    )


@router.post("/{assessment_id}/psv/submit")
async def submit_psv(assessment_id: str):
    """Submit PSV portfolio entry."""
    return {"message": "not implemented"}


@router.get("/{assessment_id}/results")
async def get_results(assessment_id: str):
    """Get assessment results and badge."""
    return {"message": "not implemented"}
