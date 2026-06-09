"""Authentication utilities: password hashing and JWT token management."""

from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

_settings = get_settings()


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt.

    Args:
        password: The plaintext password.

    Returns:
        The bcrypt-hashed password string (safe to store in database).
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored hash.

    Args:
        plain_password: The plaintext password from user input.
        hashed_password: The stored bcrypt hash from the database.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(username: str) -> str:
    """Create a JWT access token for a user.

    Args:
        username: The username to embed in the token (subject).

    Returns:
        A signed JWT token string.
    """
    expire = datetime.now(UTC) + timedelta(days=_settings.jwt_expire_days)
    payload = {
        "sub": username,
        "exp": expire,
    }
    return jwt.encode(payload, _settings.jwt_secret_key, algorithm=_settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Decode and verify a JWT access token.

    Args:
        token: The JWT token string.

    Returns:
        The username (subject) if the token is valid, None otherwise.
    """
    try:
        payload = jwt.decode(token, _settings.jwt_secret_key, algorithms=[_settings.jwt_algorithm])
        username: str | None = payload.get("sub")
        return username
    except JWTError:
        return None
