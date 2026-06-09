"""Authentication utilities: password hashing and JWT token management."""

import hashlib
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

_settings = get_settings()


def _sha256_hash(password: str) -> str:
    """Apply SHA-256 hash to password (matches frontend hashing).

    Args:
        password: The password string.

    Returns:
        SHA-256 hex digest.
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash a plaintext password using SHA-256 + bcrypt.

    The password is first hashed with SHA-256 (matching frontend behavior),
    then bcrypt is applied for secure storage.

    Args:
        password: The plaintext password.

    Returns:
        The bcrypt-hashed password string (safe to store in database).
    """
    # First apply SHA-256 (client-side also does this)
    sha_hashed = _sha256_hash(password)
    # Then apply bcrypt for secure storage
    password_bytes = sha_hashed.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored hash.

    Expects plain_password to be either:
    - A plaintext password (will be SHA-256 hashed first)
    - Already SHA-256 hashed from frontend (will be used as-is)

    Args:
        plain_password: The password from user input (plaintext or SHA-256 hash).
        hashed_password: The stored bcrypt hash from the database.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    # If it looks like a SHA-256 hash (64 hex chars), use it directly
    # Otherwise, hash it first (for backward compatibility)
    if len(plain_password) == 64 and all(c in '0123456789abcdef' for c in plain_password.lower()):
        sha_hashed = plain_password
    else:
        sha_hashed = _sha256_hash(plain_password)

    password_bytes = sha_hashed.encode("utf-8")
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
