"""FastAPI dependencies for authentication and authorization."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_access_token
from app.database import get_db
from app.models import User

# HTTP Bearer token scheme (Authorization: Bearer <token>)
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that validates the JWT token and returns the current user.

    Usage:
        @app.get("/protected")
        async def protected_endpoint(user: User = Depends(get_current_user)):
            return {"message": f"Hello, {user.username}"}

    Args:
        credentials: The HTTP Bearer token from the Authorization header.
        db: Database session.

    Returns:
        The authenticated User object.

    Raises:
        HTTPException: 401 if the token is invalid or the user is not found/inactive.
    """
    token = credentials.credentials
    username = decode_access_token(token)

    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
