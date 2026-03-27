"""LLM Client: Multi-provider support via LiteLLM.

Supports any provider (OpenAI, Anthropic, Azure, Ollama, Bedrock, etc.)
by setting the model prefix in LLM_EXECUTOR_MODEL / LLM_JUDGE_MODEL.

Examples:
  openai/gpt-4o, anthropic/claude-sonnet-4-6, ollama/llama3, azure/gpt-4o
"""

import json
import logging
from typing import Any

import litellm

from app.config import settings

logger = logging.getLogger(__name__)

# Suppress litellm's verbose logging
litellm.suppress_debug_info = True


async def execute_prompt(prompt: str, task_input: str, model: str | None = None) -> str:
    """Execute a user's prompt against task input data via LLM.

    Args:
        prompt: The user's prompt text.
        task_input: The task's input data to process.
        model: Model to use (e.g., "openai/gpt-4o"). Defaults to settings.llm_executor_model.

    Returns:
        The LLM's text response.
    """
    target_model = model or settings.llm_executor_model

    response = await litellm.acompletion(
        model=target_model,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
        messages=[
            {
                "role": "user",
                "content": f"{prompt}\n\nInput Data:\n{task_input}",
            }
        ],
    )
    return response.choices[0].message.content  # type: ignore[union-attr]


async def judge_output(
    user_prompt: str,
    task_brief: str,
    task_input: str,
    llm_output: str,
    scoring_rubric: dict[str, Any],
    success_criteria: list[str],
    model: str | None = None,
) -> dict[str, Any]:
    """Judge an LLM output using an LLM as evaluator.

    Returns structured JSON with 5-dimension scores (0-100 each):
    accuracy, completeness, prompt_efficiency, output_quality, creativity.
    """
    target_model = model or settings.llm_judge_model

    rubric_lines = []
    for dim, info in scoring_rubric.items():
        if isinstance(info, dict):
            rubric_lines.append(f"- {dim}: (weight {info.get('weight', 0.2)}) {info.get('description', dim)}")
        else:
            # Flat format: {"accuracy": 0.2}
            rubric_lines.append(f"- {dim}: (weight {info}) {dim}")
    rubric_text = "\n".join(rubric_lines)
    criteria_text = "\n".join(f"- {c}" for c in success_criteria)

    judge_prompt = f"""You are an expert evaluator for AI prompt engineering assessments.

Score the following prompt+output combination on exactly 5 dimensions. Each score must be an integer from 0 to 100.

## Task Brief (what the user was asked to do)
{task_brief}

## Input Data (provided to the LLM)
{task_input}

## Success Criteria
{criteria_text}

## Scoring Rubric
{rubric_text}

## User's Prompt
{user_prompt}

## LLM Output (produced by the user's prompt)
{llm_output}

## Instructions
Evaluate the user's prompt AND the resulting output. Consider:
1. How well the prompt elicited the correct output
2. Whether all success criteria are met
3. The quality and professionalism of the output
4. The efficiency and cleverness of the prompt itself

Return ONLY a JSON object with this exact structure (no markdown, no explanation outside JSON):
{{
  "accuracy": {{"score": <0-100>, "rationale": "<brief explanation>"}},
  "completeness": {{"score": <0-100>, "rationale": "<brief explanation>"}},
  "prompt_efficiency": {{"score": <0-100>, "rationale": "<brief explanation>"}},
  "output_quality": {{"score": <0-100>, "rationale": "<brief explanation>"}},
  "creativity": {{"score": <0-100>, "rationale": "<brief explanation>"}}
}}"""

    response = await litellm.acompletion(
        model=target_model,
        max_tokens=2048,
        temperature=0.0,
        messages=[
            {
                "role": "user",
                "content": judge_prompt,
            }
        ],
    )

    raw_text = (response.choices[0].message.content or "").strip()  # type: ignore[union-attr]

    # Parse JSON — handle possible markdown code fences
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        json_lines = []
        in_block = False
        for line in lines:
            if line.startswith("```") and not in_block:
                in_block = True
                continue
            if line.startswith("```") and in_block:
                break
            if in_block:
                json_lines.append(line)
        raw_text = "\n".join(json_lines)

    try:
        scores = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse judge response: %s", raw_text[:500])
        scores = {
            dim: {"score": 50, "rationale": "Judge response could not be parsed"}
            for dim in ["accuracy", "completeness", "prompt_efficiency", "output_quality", "creativity"]
        }

    # Validate and normalize structure
    dimensions = ["accuracy", "completeness", "prompt_efficiency", "output_quality", "creativity"]
    result: dict[str, Any] = {}
    for dim in dimensions:
        if dim in scores and isinstance(scores[dim], dict) and "score" in scores[dim]:
            score_val = max(0, min(100, int(scores[dim]["score"])))
            result[dim] = {
                "score": score_val,
                "rationale": scores[dim].get("rationale", ""),
            }
        else:
            result[dim] = {"score": 50, "rationale": "Dimension not evaluated"}

    return result
