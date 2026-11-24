"""Makes a service token as the Node backend would, so you can try the AI service by hand.

    .\\.venv\\Scripts\\python scripts\\make_token.py <business_id>

Then, for example:
    curl -X POST http://localhost:8000/internal/customer-query ^
      -H "Authorization: Bearer <the token>" -H "Content-Type: application/json" ^
      -d "{\\"message\\": \\"parle g available hai kya\\"}"

The token lives 60 seconds. It is a development tool: it needs SERVICE_JWT_SECRET from AI/.env.
"""

import os
import sys
import time

import jwt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: make_token.py <business_id>")
        return 2
    settings = get_settings()
    if not settings.service_jwt_secret:
        print("SERVICE_JWT_SECRET is not set in AI/.env")
        return 1
    now = int(time.time())
    print(
        jwt.encode(
            {
                "iss": "bizpilot-node",
                "aud": "bizpilot-ai",
                "business_id": sys.argv[1],
                "iat": now,
                "exp": now + 60,
            },
            settings.service_jwt_secret,
            algorithm="HS256",
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
