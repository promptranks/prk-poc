#!/usr/bin/env python3
"""Seed KBA questions and PPA tasks from YAML files into the database.

Idempotent: uses external_id for upserts. Safe to run multiple times.
"""

import os
import sys
import asyncio
from pathlib import Path

import yaml

# Add paths for imports — works both inside container (/app) and locally
script_dir = Path(__file__).resolve().parent
# Inside container: /app/scripts -> /app (where app/ package lives)
sys.path.insert(0, str(script_dir.parent))
# Local dev: /repo/scripts -> /repo/apps/api (where app/ package lives)
sys.path.insert(0, str(script_dir.parent / "apps" / "api"))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.models import Base
from app.models.question import Question, Task


def load_questions(content_dir: str) -> list[dict]:
    """Load all question YAML files."""
    questions = []
    questions_dir = Path(content_dir) / "questions"
    for yml_file in sorted(questions_dir.glob("pillar-*.yml")):
        with open(yml_file) as f:
            data = yaml.safe_load(f)
        pillar = data["metadata"]["pillar"]
        for q in data["questions"]:
            questions.append({
                "external_id": q["id"],
                "pillar": pillar,
                "difficulty": q["difficulty"],
                "question_type": q.get("type", "mcq"),
                "question_text": q["text"],
                "options": q["options"],
                "correct_answer": q["correct"],
                "explanation": q.get("explanation", ""),
                "tags": q.get("tags", []),
                "content_tier": "core",
                "source": "seed",
            })
    return questions


def load_tasks(content_dir: str) -> list[dict]:
    """Load all task YAML files."""
    tasks = []
    tasks_dir = Path(content_dir) / "tasks"
    for yml_file in sorted(tasks_dir.glob("task-*.yml")):
        with open(yml_file) as f:
            data = yaml.safe_load(f)
        t = data["task"]
        tasks.append({
            "external_id": t["id"],
            "title": t["title"],
            "pillar": t["pillars_tested"][0],
            "pillars_tested": t["pillars_tested"],
            "difficulty": t["difficulty"],
            "brief": t["brief"],
            "input_data": t.get("input_data", ""),
            "success_criteria": t["success_criteria"],
            "scoring_rubric": t.get("scoring_rubric"),
            "max_attempts": t.get("max_attempts", 3),
            "time_limit_seconds": t.get("time_limit_seconds", 480),
            "is_quick": t.get("is_quick", False),
            "content_tier": "core",
            "source": "seed",
        })
    return tasks


async def upsert_questions(session: AsyncSession, questions: list[dict]) -> int:
    """Upsert questions by external_id. Returns count of inserted/updated."""
    count = 0
    for q_data in questions:
        result = await session.execute(
            select(Question).where(Question.external_id == q_data["external_id"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            for key, value in q_data.items():
                setattr(existing, key, value)
        else:
            # Insert new
            question = Question(**q_data)
            session.add(question)
        count += 1

    await session.commit()
    return count


async def upsert_tasks(session: AsyncSession, tasks: list[dict]) -> int:
    """Upsert tasks by external_id. Returns count of inserted/updated."""
    count = 0
    for t_data in tasks:
        result = await session.execute(
            select(Task).where(Task.external_id == t_data["external_id"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            for key, value in t_data.items():
                setattr(existing, key, value)
        else:
            task = Task(**t_data)
            session.add(task)
        count += 1

    await session.commit()
    return count


async def main():
    content_dir = os.environ.get("CONTENT_DIR", "")
    if not content_dir or not Path(content_dir).exists():
        content_dir = str(Path(__file__).resolve().parent.parent / "content")

    if not Path(content_dir).exists():
        print(f"Content directory not found: {content_dir}")
        sys.exit(1)

    questions = load_questions(content_dir)
    tasks = load_tasks(content_dir)

    print(f"Loaded {len(questions)} questions from {len(set(q['pillar'] for q in questions))} pillars")
    print(f"Loaded {len(tasks)} tasks ({sum(1 for t in tasks if t['is_quick'])} quick, {sum(1 for t in tasks if not t['is_quick'])} full)")

    for q in questions:
        print(f"  [{q['pillar']}-D{q['difficulty']}] {q['external_id']}: {q['question_text'][:60]}...")

    for t in tasks:
        print(f"  [{'QUICK' if t['is_quick'] else 'FULL'}] {t['external_id']}: {t['title']}")

    # Connect to database
    db_url = settings.database_url
    print(f"\nConnecting to database: {db_url.split('@')[-1] if '@' in db_url else 'local'}...")

    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        q_count = await upsert_questions(session, questions)
        t_count = await upsert_tasks(session, tasks)

    await engine.dispose()

    print(f"\nSeeded {q_count} questions and {t_count} tasks into database.")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
