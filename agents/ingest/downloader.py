"""Download the Magic Comprehensive Rules .txt.

Resolution order:
  1. Explicit URL from config/env (CR_TXT_URL).
  2. Auto-discovery: scrape the official rules page for the .txt link.

The CR file is small (~2 MB). Encoding varies by release, so we decode
defensively (utf-8-sig → cp1252).
"""

from __future__ import annotations

import re

import httpx

from agents.config import get_settings

_TXT_LINK = re.compile(r'href=["\']([^"\']+?\.txt)["\']', re.IGNORECASE)
_USER_AGENT = "deckalization/0.1 (MTG rules referee)"


def discover_cr_txt_url(client: httpx.Client) -> str:
    """Find the CR .txt link on the official rules page."""
    settings = get_settings()
    resp = client.get(settings.ingest.cr_rules_page)
    resp.raise_for_status()
    candidates = _TXT_LINK.findall(resp.text)
    if not candidates:
        raise RuntimeError(
            "Could not auto-discover the Comprehensive Rules .txt link. "
            "Set CR_TXT_URL in your environment to the current download URL."
        )
    # Prefer links that look like the comprehensive rules download.
    for url in candidates:
        if "rules" in url.lower() or "comp" in url.lower():
            return url
    return candidates[0]


def _decode(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def download_cr_text() -> tuple[str, str]:
    """Return (raw_text, source_url) for the Comprehensive Rules."""
    settings = get_settings()
    headers = {"User-Agent": _USER_AGENT}
    with httpx.Client(headers=headers, follow_redirects=True, timeout=60.0) as client:
        url = settings.ingest.cr_txt_url or discover_cr_txt_url(client)
        resp = client.get(url)
        resp.raise_for_status()
        return _decode(resp.content), url
