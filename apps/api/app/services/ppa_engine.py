"""PPA Engine: task selection, execution, attempt tracking, and judging."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Task
from app.services.llm_client import execute_prompt, judge_output

logger = logging.getLogger(__name__)

# Default max attempts for quick/full modes
QUICK_MAX_ATTEMPTS = 2
FULL_MAX_ATTEMPTS = 3


async def select_tasks(db: AsyncSession, mode: str) -> list[Task]:
    """Select PPA tasks for an assessment.

    Quick: 1 task (is_quick=True)
    Full: 3 tasks (mixed, from different pillars if possible)
    """
    if mode == "quick":
        result = await db.execute(
            select(Task).where(Task.is_active == True, Task.is_quick == True)  # noqa: E712
        )
        tasks = list(result.scalars().all())
        if tasks:
            import random
            return random.sample(tasks, min(1, len(tasks)))
        return []
    else:
        # Full mode: select up to 3 tasks from different pillars
        result = await db.execute(
            select(Task).where(Task.is_active == True)  # noqa: E712
        )
        tasks = list(result.scalars().all())
        if not tasks:
            return []

        import random
        # Try to pick from different pillars
        by_pillar: dict[str, list[Task]] = {}
        for t in tasks:
            by_pillar.setdefault(t.pillar, []).append(t)

        selected: list[Task] = []
        pillars = list(by_pillar.keys())
        random.shuffle(pillars)

        for pillar in pillars:
            if len(selected) >= 3:
                break
            pool = by_pillar[pillar]
            selected.append(random.choice(pool))

        # If we don't have 3 from different pillars, fill from remaining
        remaining = [t for t in tasks if t not in selected]
        while len(selected) < 3 and remaining:
            pick = random.choice(remaining)
            remaining.remove(pick)
            selected.append(pick)

        return selected[:3]


def get_task_brief(task: Task) -> dict[str, Any]:
    """Return task data suitable for the user (excludes scoring_rubric).

    The scoring rubric is hidden so users don't know exactly what's being judged.
    """
    return {
        "task_id": str(task.id),
        "external_id": task.external_id,
        "title": task.title,
        "pillar": task.pillar,
        "pillars_tested": task.pillars_tested or [task.pillar],
        "difficulty": task.difficulty,
        "brief": task.brief,
        "input_data": task.input_data or "",
        "success_criteria": task.success_criteria or [],
        "max_attempts": task.max_attempts or FULL_MAX_ATTEMPTS,
    }


def get_attempt_count(ppa_responses: dict | None, task_id: str) -> int:
    """Get the number of attempts made for a specific task."""
    if not ppa_responses or "tasks" not in ppa_responses:
        return 0
    task_data = ppa_responses["tasks"].get(task_id)
    if not task_data or "attempts" not in task_data:
        return 0
    return len(task_data["attempts"])


def get_max_attempts(task: Task, mode: str) -> int:
    """Get max attempts for a task based on assessment mode."""
    if mode == "quick":
        return min(int(task.max_attempts or QUICK_MAX_ATTEMPTS), QUICK_MAX_ATTEMPTS)
    return task.max_attempts or FULL_MAX_ATTEMPTS


def store_attempt(
    ppa_responses: dict | None,
    task_id: str,
    prompt: str,
    output: str,
    attempt_number: int,
) -> dict:
    """Store an attempt in ppa_responses JSON.

    Structure:
    {
        "task_ids": ["uuid1", "uuid2"],
        "tasks": {
            "uuid1": {
                "attempts": [
                    {"attempt": 1, "prompt": "...", "output": "..."},
                    {"attempt": 2, "prompt": "...", "output": "..."}
                ],
                "selected_best": null  # index of best attempt, set on submit
            }
        }
    }
    """
    if ppa_responses is None:
        ppa_responses = {"task_ids": [], "tasks": {}}
    if "tasks" not in ppa_responses:
        ppa_responses["tasks"] = {}
    if "task_ids" not in ppa_responses:
        ppa_responses["task_ids"] = []

    if task_id not in ppa_responses["tasks"]:
        ppa_responses["tasks"][task_id] = {"attempts": [], "selected_best": None}
        if task_id not in ppa_responses["task_ids"]:
            ppa_responses["task_ids"].append(task_id)

    ppa_responses["tasks"][task_id]["attempts"].append({
        "attempt": attempt_number,
        "prompt": prompt,
        "output": output,
    })

    return ppa_responses


async def execute_task_prompt(
    prompt: str,
    task: Task,
) -> str:
    """Execute the user's prompt against a task's input data.

    Returns the LLM output text.
    """
    input_data = task.input_data or ""
    return await execute_prompt(prompt, input_data)


async def judge_task_output(
    task: Task,
    user_prompt: str,
    llm_output: str,
) -> dict[str, Any]:
    """Judge a task output using the LLM judge.

    Returns 5-dimension scores: accuracy, completeness, prompt_efficiency,
    output_quality, creativity (each 0-100 with rationale).
    """
    scoring_rubric = task.scoring_rubric or {
        "accuracy": {"weight": 0.30, "description": "Output accuracy and correctness"},
        "completeness": {"weight": 0.25, "description": "All requirements met"},
        "prompt_efficiency": {"weight": 0.20, "description": "Prompt conciseness and clarity"},
        "output_quality": {"weight": 0.15, "description": "Output formatting and quality"},
        "creativity": {"weight": 0.10, "description": "Creative use of prompting techniques"},
    }

    success_criteria: list[str] = task.success_criteria or []

    return await judge_output(
        user_prompt=user_prompt,
        task_brief=task.brief,
        task_input=task.input_data or "",
        llm_output=llm_output,
        scoring_rubric=scoring_rubric,
        success_criteria=success_criteria,
    )


def compute_ppa_score(judge_results: dict[str, Any], scoring_rubric: dict[str, Any] | None = None) -> float:
    """Compute weighted PPA score from judge dimension scores.

    Default weights: accuracy=0.30, completeness=0.25, prompt_efficiency=0.20,
    output_quality=0.15, creativity=0.10
    """
    default_weights = {
        "accuracy": 0.30,
        "completeness": 0.25,
        "prompt_efficiency": 0.20,
        "output_quality": 0.15,
        "creativity": 0.10,
    }

    weights = {}
    if scoring_rubric:
        for dim, info in scoring_rubric.items():
            if isinstance(info, dict) and "weight" in info:
                weights[dim] = info["weight"]
            elif isinstance(info, (int, float)):
                weights[dim] = float(info)

    total = 0.0
    for dim in ["accuracy", "completeness", "prompt_efficiency", "output_quality", "creativity"]:
        weight = weights.get(dim, default_weights.get(dim, 0.2))
        dim_data = judge_results.get(dim, {})
        score = dim_data.get("score", 0) if isinstance(dim_data, dict) else 0
        total += weight * score

    return round(total, 1)
