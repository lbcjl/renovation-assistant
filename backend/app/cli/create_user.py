"""CLI tool to create a new user account.

Usage:
    python -m app.cli.create_user <username> <password>

Example:
    python -m app.cli.create_user admin MySecurePassword123
"""

import asyncio
import sys

from sqlalchemy import select

from app.auth import hash_password
from app.database import AsyncSessionLocal
from app.models import User


async def create_user(username: str, password: str) -> None:
    """Create a new user account with the given username and password.

    Args:
        username: The username (must be unique).
        password: The plaintext password (will be hashed before storage).

    Raises:
        ValueError: If username already exists.
    """
    async with AsyncSessionLocal() as session:
        # Check if user already exists
        result = await session.execute(select(User).where(User.username == username))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise ValueError(f"User '{username}' already exists.")

        # Create new user
        hashed_password = hash_password(password)
        new_user = User(username=username, hashed_password=hashed_password, is_active=True)
        session.add(new_user)
        await session.commit()

        print(f"[OK] User '{username}' created successfully.")


async def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python -m app.cli.create_user <username> <password>")
        print("Example: python -m app.cli.create_user admin MySecurePassword123")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]

    if len(username) < 3:
        print("Error: Username must be at least 3 characters long.")
        sys.exit(1)

    if len(password) < 8:
        print("Error: Password must be at least 8 characters long.")
        sys.exit(1)

    try:
        await create_user(username, password)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
