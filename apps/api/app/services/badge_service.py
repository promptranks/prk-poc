"""Badge service: SVG generation with level, score, PECAM radar, date, mode label."""

import math
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.assessment import Assessment
from app.models.badge import Badge
from app.models.user import User

PILLARS = ["P", "E", "C", "A", "M"]
PILLAR_LABELS = {"P": "Precision", "E": "Efficiency", "C": "Creativity", "A": "Adaptability", "M": "Mastery"}

LEVEL_NAMES: dict[int, str] = {
    1: "Novice",
    2: "Practitioner",
    3: "Proficient",
    4: "Expert",
    5: "Master",
}

LEVEL_COLORS: dict[int, str] = {
    1: "#666666",
    2: "#008f11",
    3: "#00ff41",
    4: "#6D5FFA",
    5: "#EC41FB",
}


def _generate_radar_svg(pillar_scores: dict[str, Any], cx: float, cy: float, max_radius: float) -> str:
    """Generate SVG elements for a PECAM radar chart."""
    angle_step = 2 * math.pi / len(PILLARS)
    start_angle = -math.pi / 2

    def get_point(index: int, value: float) -> tuple[float, float]:
        angle = start_angle + index * angle_step
        r = (value / 100) * max_radius
        return (cx + r * math.cos(angle), cy + r * math.sin(angle))

    parts: list[str] = []

    # Grid polygons
    for level_pct in [20, 40, 60, 80, 100]:
        points = " ".join(f"{get_point(i, level_pct)[0]:.1f},{get_point(i, level_pct)[1]:.1f}" for i in range(5))
        parts.append(f'<polygon points="{points}" fill="none" stroke="rgba(0,255,65,0.15)" stroke-width="0.5"/>')

    # Axis lines
    for i in range(5):
        x, y = get_point(i, 100)
        parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="rgba(0,255,65,0.2)" stroke-width="0.5"/>')

    # Data polygon
    data_points: list[tuple[float, float]] = []
    for i, p in enumerate(PILLARS):
        score_data = pillar_scores.get(p, {})
        score = float(score_data.get("combined", 0)) if isinstance(score_data, dict) else float(score_data)
        data_points.append(get_point(i, score))

    data_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in data_points)
    parts.append(f'<polygon points="{data_str}" fill="rgba(0,255,65,0.2)" stroke="#00ff41" stroke-width="1.5"/>')

    # Data dots
    for x, y in data_points:
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.5" fill="#00ff41"/>')

    # Labels
    label_radius = max_radius + 14
    for i, p in enumerate(PILLARS):
        angle = start_angle + i * angle_step
        lx = cx + label_radius * math.cos(angle)
        ly = cy + label_radius * math.sin(angle)
        score_data = pillar_scores.get(p, {})
        score = round(float(score_data.get("combined", 0))) if isinstance(score_data, dict) else round(float(score_data))
        parts.append(
            f'<text x="{lx:.1f}" y="{ly - 5:.1f}" text-anchor="middle" fill="#00ff41" '
            f'font-size="9" font-family="monospace" font-weight="bold">{p}</text>'
        )
        parts.append(
            f'<text x="{lx:.1f}" y="{ly + 7:.1f}" text-anchor="middle" fill="#008f11" '
            f'font-size="7" font-family="monospace">{score}%</text>'
        )

    return "\n    ".join(parts)


def _get_badge_domain() -> str:
    """Get the domain for badge verification URLs and branding."""
    return settings.deployment_domain or "promptranks.org"


def generate_badge_svg(
    level: int,
    level_name: str,
    final_score: float,
    pillar_scores: dict[str, Any],
    issued_at: datetime,
    mode: str,
    badge_id: str,
) -> str:
    """Generate a complete badge SVG with level, score, radar chart, date, and mode label."""
    color = LEVEL_COLORS.get(level, "#00ff41")
    mode_label = "Certified" if mode == "full" else "Estimated"
    date_str = issued_at.strftime("%Y-%m-%d")
    domain = _get_badge_domain()
    verification_url = f"https://{domain}/badges/verify/{badge_id}"
    domain_label = domain

    # Radar chart centered at (200, 175), radius 55
    radar = _generate_radar_svg(pillar_scores, 200, 175, 55)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#001a00"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="400" height="320" rx="8" fill="url(#bg)" stroke="{color}" stroke-width="2"/>

  <!-- Header -->
  <text x="200" y="30" text-anchor="middle" fill="#00ff41" font-size="11" font-family="monospace" font-weight="bold" letter-spacing="3">PROMPTRANKS</text>
  <text x="200" y="46" text-anchor="middle" fill="#008f11" font-size="8" font-family="monospace">{mode_label} Assessment</text>

  <!-- Level badge -->
  <rect x="135" y="55" width="130" height="28" rx="4" fill="none" stroke="{color}" stroke-width="1.5"/>
  <text x="200" y="73" text-anchor="middle" fill="{color}" font-size="12" font-family="monospace" font-weight="bold">L{level} - {level_name}</text>

  <!-- Score -->
  <text x="200" y="100" text-anchor="middle" fill="{color}" font-size="24" font-family="monospace" font-weight="bold">{round(final_score)}</text>
  <text x="200" y="112" text-anchor="middle" fill="#008f11" font-size="8" font-family="monospace">FINAL SCORE</text>

  <!-- Radar chart -->
  <g>
    {radar}
  </g>

  <!-- Footer -->
  <line x1="20" y1="260" x2="380" y2="260" stroke="rgba(0,255,65,0.15)" stroke-width="0.5"/>
  <text x="200" y="278" text-anchor="middle" fill="#008f11" font-size="7" font-family="monospace">Issued: {date_str}</text>
  <text x="200" y="292" text-anchor="middle" fill="#008f11" font-size="6" font-family="monospace">Verify: {verification_url}</text>
  <text x="200" y="308" text-anchor="middle" fill="rgba(0,255,65,0.3)" font-size="6" font-family="monospace">{domain_label}</text>
</svg>'''

    return svg


async def create_badge(
    db: AsyncSession,
    user: User,
    assessment: Assessment,
) -> Badge:
    """Create a badge for a claimed assessment."""
    level = assessment.level or 1
    level_name = LEVEL_NAMES.get(level, "Novice")
    final_score = assessment.final_score or 0.0
    pillar_scores: dict[str, Any] = assessment.pillar_scores or {}
    mode = assessment.mode.value if hasattr(assessment.mode, "value") else str(assessment.mode)
    now = datetime.now(timezone.utc)

    badge_id = uuid.uuid4()
    badge_id_str = str(badge_id)

    badge_svg = generate_badge_svg(
        level=level,
        level_name=level_name,
        final_score=final_score,
        pillar_scores=pillar_scores,
        issued_at=now,
        mode=mode,
        badge_id=badge_id_str,
    )

    domain = _get_badge_domain()
    verification_url = f"https://{domain}/badges/verify/{badge_id_str}"

    badge = Badge(
        id=badge_id,
        user_id=user.id,
        assessment_id=assessment.id,
        mode=mode,
        level=level,
        level_name=level_name,
        final_score=final_score,
        pillar_scores=pillar_scores,
        badge_svg=badge_svg,
        verification_url=verification_url,
        issuer_domain=domain,
        issued_at=now,
    )
    db.add(badge)
    await db.commit()
    await db.refresh(badge)
    return badge
