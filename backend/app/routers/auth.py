"""Authentication endpoints: login and user info."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Authenticate a user and return a JWT access token.

    Args:
        request: Login credentials (username and password).
        db: Database session.

    Returns:
        JWT access token and user info.

    Raises:
        HTTPException: 401 if credentials are invalid.
    """
    # Find user by username
    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()

    # Verify user exists, is active, and password is correct
    if (
        user is None
        or not user.is_active
        or not verify_password(request.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT token
    access_token = create_access_token(user.username)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        username=user.username,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: User = Depends(get_current_user)) -> UserResponse:
    """Get information about the currently authenticated user.

    Requires a valid JWT token in the Authorization header.

    Args:
        user: The authenticated user (injected by dependency).

    Returns:
        User information.
    """
    return UserResponse(username=user.username, is_active=user.is_active)
