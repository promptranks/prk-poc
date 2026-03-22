from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://promptranks:promptranks-dev@localhost:5432/promptranks"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 60

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # LLM (provider set via model prefix: openai/gpt-4o, anthropic/claude-sonnet-4-6, etc.)
    llm_executor_model: str = "openai/gpt-4o"
    llm_judge_model: str = "openai/gpt-4o"
    llm_max_tokens: int = 4096
    llm_temperature: float = 0.1

    # Assessment timers (seconds)
    quick_assessment_time_limit: int = 900
    full_kba_time_limit: int = 900
    full_ppa_time_limit: int = 1800

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
