"""
QuickBooks OAuth2 Nightly Token Refresh

Refreshes tokens for both Pharmacy Pearls LLC and Jasper Phoenix Group,
then writes the new refresh tokens back to:
  1. .env.universal (master credentials)
  2. quickbooks-mcp-server/.env (MCP server)
  3. Claude Desktop config (if quickbooks MCP block exists)
  4. .claude.json (if quickbooks MCP block exists)

Run nightly via Windows Task Scheduler to keep tokens alive indefinitely.
QuickBooks refresh tokens expire after 100 days; each refresh gives a new one.

Usage:
  python nightly-refresh.py           # refresh both companies
  python nightly-refresh.py --dry-run # test without saving
"""

import base64
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
ENV_UNIVERSAL = Path(r"C:\Users\User\.env.universal")
ENV_MCP = SCRIPT_DIR / ".env"
CLAUDE_DESKTOP_CFG = Path(r"C:\Users\User\AppData\Roaming\Claude\claude_desktop_config.json")
CLAUDE_JSON = Path(r"C:\Users\User\.claude.json")
LOG_FILE = SCRIPT_DIR / "refresh.log"

TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

# Company definitions — realm IDs are stable, tokens rotate on each refresh
COMPANIES = {
    "PP": {
        "name": "Pharmacy Pearls LLC",
        "realm_env_key": "QUICKBOOKS_PP_REALM_ID",
        "token_env_key": "QUICKBOOKS_PP_REFRESH_TOKEN",
    },
    "JPG": {
        "name": "Jasper Phoenix Group",
        "realm_env_key": "QUICKBOOKS_JPG_REALM_ID",
        "token_env_key": "QUICKBOOKS_JPG_REFRESH_TOKEN",
    },
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def read_env_file(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def get_env_value(content: str, key: str) -> str | None:
    """Extract value for KEY=value from env file content."""
    match = re.search(rf'^{re.escape(key)}=(.+)$', content, re.MULTILINE)
    return match.group(1).strip() if match else None


def set_env_value(content: str, key: str, value: str) -> str:
    """Set KEY=value in env file content, updating existing or appending."""
    pattern = rf'^{re.escape(key)}=.*$'
    replacement = f"{key}={value}"
    if re.search(pattern, content, re.MULTILINE):
        return re.sub(pattern, replacement, content, flags=re.MULTILINE)
    else:
        return content.rstrip("\n") + f"\n{replacement}\n"


def refresh_token(client_id: str, client_secret: str, refresh_tok: str) -> dict:
    """Exchange a refresh token for new access + refresh tokens."""
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    resp = requests.post(
        TOKEN_URL,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_tok,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def update_claude_json(file_path: Path, refresh_tok: str, realm_id: str, company: str):
    """Update quickbooks MCP env block in Claude config JSON files."""
    if not file_path.exists():
        return

    try:
        cfg = json.loads(file_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return

    changed = False

    def patch(obj):
        nonlocal changed
        if not obj or not isinstance(obj, dict):
            return
        qb = obj.get("quickbooks", {})
        env = qb.get("env", {})
        if env:
            env["QUICKBOOKS_REFRESH_TOKEN"] = refresh_tok
            env["QUICKBOOKS_REALM_ID"] = realm_id
            changed = True

    # Top-level mcpServers
    patch(cfg.get("mcpServers", {}))

    # Per-project mcpServers
    for proj in (cfg.get("projects") or {}).values():
        if isinstance(proj, dict):
            patch(proj.get("mcpServers", {}))

    if changed:
        file_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
        log(f"  Updated {file_path.name} (realm={realm_id})")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    dry_run = "--dry-run" in sys.argv

    log("=" * 60)
    log(f"QuickBooks token refresh {'(DRY RUN)' if dry_run else 'started'}")

    # Read credentials from .env.universal
    universal = read_env_file(ENV_UNIVERSAL)
    client_id = get_env_value(universal, "QUICKBOOKS_CLIENT_ID")
    client_secret = get_env_value(universal, "QUICKBOOKS_CLIENT_SECRET")

    if not client_id or not client_secret:
        log("ERROR: QUICKBOOKS_CLIENT_ID or CLIENT_SECRET not found in .env.universal")
        sys.exit(1)

    mcp_env = read_env_file(ENV_MCP)
    success_count = 0
    last_pp_token = None
    last_pp_realm = None

    for code, company in COMPANIES.items():
        token_key = company["token_env_key"]
        realm_key = company["realm_env_key"]

        current_token = get_env_value(universal, token_key)
        realm_id = get_env_value(universal, realm_key)

        if not current_token:
            log(f"  SKIP {company['name']}: no {token_key} in .env.universal")
            continue

        if not realm_id:
            log(f"  SKIP {company['name']}: no {realm_key} in .env.universal")
            continue

        log(f"  Refreshing {company['name']} (realm {realm_id})...")

        if dry_run:
            log(f"  DRY RUN: would refresh {token_key} = {current_token[:25]}...")
            success_count += 1
            continue

        try:
            result = refresh_token(client_id, client_secret, current_token)
            new_refresh = result["refresh_token"]
            expires_days = result.get("x_refresh_token_expires_in", 0) / 86400

            log(f"  OK — new token: {new_refresh[:25]}... (expires in {expires_days:.0f} days)")

            # 1. Update .env.universal — company-specific key
            universal = set_env_value(universal, token_key, new_refresh)

            # Track PP token for default keys
            if code == "PP":
                last_pp_token = new_refresh
                last_pp_realm = realm_id

            success_count += 1

        except requests.HTTPError as e:
            log(f"  FAILED {company['name']}: HTTP {e.response.status_code} — {e.response.text[:200]}")
        except Exception as e:
            log(f"  FAILED {company['name']}: {e}")

    if dry_run:
        log(f"DRY RUN complete. {success_count}/{len(COMPANIES)} would refresh.")
        return

    if success_count == 0:
        log("ERROR: No tokens were refreshed successfully")
        sys.exit(1)

    # Update default keys in .env.universal (PP is the default)
    if last_pp_token:
        universal = set_env_value(universal, "QUICKBOOKS_REFRESH_TOKEN", last_pp_token)
        universal = set_env_value(universal, "QUICKBOOKS_REALM_ID", last_pp_realm)

    # Write .env.universal
    ENV_UNIVERSAL.write_text(universal, encoding="utf-8")
    log(f"  Saved .env.universal ({success_count} tokens updated)")

    # Write MCP server .env — use PP as default for MCP server
    if last_pp_token:
        mcp_env = set_env_value(mcp_env, "QUICKBOOKS_REFRESH_TOKEN", last_pp_token)
        mcp_env = set_env_value(mcp_env, "QUICKBOOKS_REALM_ID", last_pp_realm)
        ENV_MCP.write_text(mcp_env, encoding="utf-8")
        log(f"  Saved quickbooks-mcp-server/.env")

    # Update Claude config JSON files (use PP as default)
    if last_pp_token:
        update_claude_json(CLAUDE_DESKTOP_CFG, last_pp_token, last_pp_realm, "PP")
        update_claude_json(CLAUDE_JSON, last_pp_token, last_pp_realm, "PP")

    log(f"Refresh complete. {success_count}/{len(COMPANIES)} companies refreshed.")
    log("=" * 60)


if __name__ == "__main__":
    main()
