"""
JWT token verification for Keycloak-issued access tokens.

Provides a FastAPI dependency ``verify_token`` that validates the Bearer token
from the ``Authorization`` header against the Keycloak realm's public key.
When ``AUTH_ENABLED=false`` in settings, authentication is bypassed for
local development convenience.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Annotated

import httpx
import jwt as pyjwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)

# Cached Keycloak public key (fetched once on first request).
_keycloak_public_key: str | None = None


@dataclass(frozen=True, slots=True)
class TokenPayload:
    """Decoded JWT claims relevant to OpenSalesAI."""

    sub: str  # Keycloak user ID
    email: str = ""
    name: str = ""
    preferred_username: str = ""
    tenant_id: str = ""
    company_id: str = ""
    roles: list[str] = field(default_factory=list)
    realm_access: dict = field(default_factory=dict)


async def _fetch_keycloak_public_key(settings: Settings) -> str:
    """Fetch the RSA public key from the Keycloak realm endpoint."""
    global _keycloak_public_key  # noqa: PLW0603
    if _keycloak_public_key is not None:
        return _keycloak_public_key

    url = f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            raw_key = data["public_key"]
            # Wrap in PEM header / footer
            _keycloak_public_key = (
                f"-----BEGIN PUBLIC KEY-----\n{raw_key}\n-----END PUBLIC KEY-----"
            )
            logger.info("Keycloak public key fetched successfully.")
            return _keycloak_public_key
    except Exception:
        logger.exception("Failed to fetch Keycloak public key from %s", url)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable.",
        )


def _decode_token(token: str, public_key: str, settings: Settings) -> dict:
    """Decode and verify a JWT using the Keycloak RSA public key."""
    try:
        payload = pyjwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=settings.KEYCLOAK_CLIENT_ID,
            options={
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            },
            issuer=f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}",
        )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        )
    except pyjwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience.",
        )
    except pyjwt.PyJWTError as exc:
        logger.warning("JWT decode error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


def _extract_token_payload(decoded: dict) -> TokenPayload:
    """Map raw JWT claims to a ``TokenPayload`` dataclass."""
    realm_access = decoded.get("realm_access", {})
    roles = realm_access.get("roles", [])

    # Custom claims injected via Keycloak mapper
    tenant_id = decoded.get("tenant_id", decoded.get("tenantId", ""))
    company_id = decoded.get("company_id", decoded.get("companyId", ""))

    return TokenPayload(
        sub=decoded.get("sub", ""),
        email=decoded.get("email", ""),
        name=decoded.get("name", ""),
        preferred_username=decoded.get("preferred_username", ""),
        tenant_id=tenant_id,
        company_id=company_id,
        roles=roles,
        realm_access=realm_access,
    )


async def verify_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Security(_bearer_scheme)
    ] = None,
    settings: Settings = Depends(get_settings),
) -> TokenPayload:
    """FastAPI dependency that verifies the JWT bearer token.

    Returns a ``TokenPayload`` with the decoded claims. When
    ``AUTH_ENABLED=false``, returns a dev-mode stub payload so that local
    development works without Keycloak running.

    Usage::

        @router.get("/protected")
        async def protected(user: TokenPayload = Depends(verify_token)):
            ...
    """
    # ── Dev bypass ────────────────────────────────────────────────────
    if not settings.AUTH_ENABLED:
        return TokenPayload(
            sub="dev-user-000",
            email="dev@opensalesai.local",
            name="Dev User",
            preferred_username="devuser",
            tenant_id="00000000-0000-0000-0000-000000000001",
            company_id="00000000-0000-0000-0000-000000000001",
            roles=["admin", "manager", "rep"],
        )

    # ── Token presence check ──────────────────────────────────────────
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    public_key = await _fetch_keycloak_public_key(settings)
    decoded = _decode_token(token, public_key, settings)
    return _extract_token_payload(decoded)


# Convenience type alias for route parameters.
CurrentUser = Annotated[TokenPayload, Depends(verify_token)]


def require_role(required_role: str):
    """Factory for a dependency that checks the user has a specific realm role.

    Usage::

        @router.post("/admin-only", dependencies=[Depends(require_role("admin"))])
        async def admin_endpoint():
            ...
    """

    async def _check(user: CurrentUser) -> TokenPayload:
        if required_role not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required.",
            )
        return user

    return _check
