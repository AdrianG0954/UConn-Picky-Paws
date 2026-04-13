import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv


import jwt
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.exceptions import HTTPException

load_dotenv()
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")


class AuthService:

    def create_login_jwt(self, netid: str) -> str:
        """
        Creates a JWT token the frontend can use to authenticate with the backend.
        """
        try:
            payload = {
                "sub": netid,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
                "iat": datetime.now(timezone.utc),
            }
            return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        except Exception:
            print("Failed to generate JWT token for logging in")
            raise

    def verify_login_jwt(self, credentials: HTTPAuthorizationCredentials) -> None:
        """
        Verifies a JWT token and raises an exception if the token is invalid.
        """
        try:
            token = credentials.credentials

            # user is authenticated if we can decode the token
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
