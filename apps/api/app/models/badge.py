import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.models.user import Base


class Badge(Base):
    __tablename__ = "badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, unique=True)
    mode = Column(String, nullable=False)  # "quick" or "full"
    level = Column(Integer, nullable=False)  # 1-5
    level_name = Column(String, nullable=False)  # "Foundational", "Practitioner", etc.
    final_score = Column(Float, nullable=False)
    pillar_scores = Column(JSON, nullable=False)  # {"P": 85, "E": 78, ...}
    badge_svg = Column(String, nullable=True)  # rendered SVG content
    verification_url = Column(String, nullable=True)
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
