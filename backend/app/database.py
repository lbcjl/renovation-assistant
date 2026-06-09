"""Database configuration and session management.

SQLAlchemy async engine and session factory for SQLite. The database file
lives at `data/database.db` (alongside the RAG index directory).
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

_settings = get_settings()

# SQLite async URL: aiosqlite dialect
DATABASE_URL = f"sqlite+aiosqlite:///{_settings.database_path}"

# Create async engine (echo=False in production; set to True for SQL logging)
engine = create_async_engine(DATABASE_URL, echo=False, future=True)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a database session.

    Usage:
        @app.post("/endpoint")
        async def endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        yield session
