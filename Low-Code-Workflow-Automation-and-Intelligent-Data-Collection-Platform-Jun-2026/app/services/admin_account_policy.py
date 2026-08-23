from __future__ import annotations

from typing import Any, Dict, Optional


class AdminAccountPolicy:
    """Centralized decision helper that resolves whether a Firebase identity exchange
    should instantiate or promote the local account as an admin workspace owner.

    The policy is intentionally strict:
    - Firebase custom claims are authoritative for existing accounts.
    - The client-supplied role is accepted only during the registration/login token exchange
      for a brand-new account and is never treated as a ticket to hallucinate a claim that
      belongs to a different user.
    - A role decision is never allowed to be silently interpreted as user because the
      browser has an orphaned or stale role in localStorage.
    """

    @staticmethod
    def resolve_requested_role(
        payload_role: Optional[str],
        firebase_claims: Optional[Dict[str, Any]] = None,
    ) -> str:
        claims = firebase_claims or {}
        if bool(
            claims.get("admin")
            or claims.get("is_admin")
            or claims.get("superuser")
            or (claims.get("role") == "admin")
        ):
            return "admin"
        if isinstance(payload_role, str) and payload_role.strip().lower() == "admin":
            return "admin"
        return "user"

    @staticmethod
    def create_or_upgrade_superuser(
        user: Any,
        role: str,
        is_new_account: bool,
        firebase_claims: Optional[Dict[str, Any]] = None,
    ) -> bool:
        claims = firebase_claims or {}
        admin_claim = bool(
            claims.get("admin")
            or claims.get("is_admin")
            or claims.get("superuser")
            or (claims.get("role") == "admin")
        )

        # A new account is allowed to receive admin capability when the acknowledged
        # runtime role says admin. The bool must not default to False if the browser
        # selected admin in the current exchange.
        if is_new_account:
            user.is_superuser = bool(admin_claim or role == "admin")
            return user.is_superuser

        # Existing account promotion is only allowed when the Firebase identity contract
        # proves the admin claim exists. Registration-time selection is not enough to move
        # a pre-existing user from user to admin.
        if admin_claim:
            user.is_superuser = True
            return True
        if role == "admin" and not user.is_superuser:
            raise PermissionError("Admin account required")
        return bool(user.is_superuser)
