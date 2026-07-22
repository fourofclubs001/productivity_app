from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:5173"]
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""


settings = Settings()
