from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./motogo.db"
    secret_key: str = "dev-secret-change-me"
    field_encryption_key: str = ""  # derived from secret_key when empty
    webhook_secret: str = "dev-webhook-secret"
    access_ttl_min: int = 15
    refresh_ttl_days: int = 14
    cookie_secure: bool = False
    storage_dir: str = "./.storage"
    public_api_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173"

    # mock behaviour
    mock_delay_min: float = 2.0
    mock_delay_max: float = 4.0
    sync_jobs: bool = False  # run background jobs inline (tests)

    # adapter selection: mock | live
    adapter_otp: str = "mock"
    adapter_catalogue: str = "mock"
    adapter_valuation: str = "mock"
    adapter_kyc: str = "mock"
    adapter_bureau: str = "mock"
    adapter_aa: str = "mock"
    adapter_docparser: str = "mock"
    adapter_lender: str = "mock"
    adapter_mandate: str = "mock"
    adapter_esign: str = "mock"
    adapter_storage: str = "local"  # local | s3

    max_upload_bytes: int = 10 * 1024 * 1024
    max_docs_per_application: int = 40


settings = Settings()


def any_mock() -> bool:
    return any(
        getattr(settings, f"adapter_{n}") == "mock"
        for n in ("kyc", "bureau", "aa", "lender", "mandate", "esign", "docparser")
    )
