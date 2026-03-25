import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.models.user import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String, unique=True, nullable=False, index=True)  # e.g. "P-001"
    pillar = Column(String(1), nullable=False, index=True)  # P, E, C, M, A
    difficulty = Column(Integer, nullable=False)  # 1=easy, 2=medium, 3=hard
    question_type = Column(String, nullable=False, default="mcq")  # mcq, multi_select, true_false
    question_text = Column(String, nullable=False)
    options = Column(JSON, nullable=False)  # list of option strings
    correct_answer = Column(JSON, nullable=False)  # index or list of indices
    explanation = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)
    content_tier = Column(String, nullable=False, default="core", index=True)  # core, premium, enterprise, local
    content_pack_id = Column(UUID(as_uuid=True), ForeignKey("content_packs.id"), nullable=True)
    source = Column(String, nullable=False, default="seed")  # seed, registry, manual, import
    usage_count = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    pillar = Column(String(1), nullable=False, index=True)
    pillars_tested = Column(JSON, nullable=True)  # for multi-pillar tasks: ["P", "C", "A"]
    difficulty = Column(Integer, nullable=False)
    brief = Column(String, nullable=False)
    input_data = Column(String, nullable=True)
    success_criteria = Column(JSON, nullable=False)
    scoring_rubric = Column(JSON, nullable=True)
    max_attempts = Column(Integer, default=3)
    time_limit_seconds = Column(Integer, default=480)
    is_quick = Column(Boolean, default=False)  # eligible for Quick Assessment
    content_tier = Column(String, nullable=False, default="core", index=True)  # core, premium, enterprise, local
    content_pack_id = Column(UUID(as_uuid=True), ForeignKey("content_packs.id"), nullable=True)
    source = Column(String, nullable=False, default="seed")  # seed, registry, manual, import
    usage_count = Column(Integer, default=0)
    avg_score = Column(Float, nullable=True)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
