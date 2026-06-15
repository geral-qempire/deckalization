"""Canonical card-name normalization — Python mirror of convex/lib/normalize.ts.

These two implementations MUST stay byte-for-byte equivalent, or exact-match
card lookups (Python side) will miss rows written by the TS ingester.
"""

from __future__ import annotations

import re
import unicodedata

_APOSTROPHES = re.compile(r"['\u2019]")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_WHITESPACE = re.compile(r"\s+")


def normalize_name(name: str) -> str:
    """Lowercase, strip diacritics/apostrophes/punctuation, collapse whitespace."""
    decomposed = unicodedata.normalize("NFKD", name)
    without_marks = "".join(c for c in decomposed if not unicodedata.combining(c))
    lowered = without_marks.lower()
    no_apostrophes = _APOSTROPHES.sub("", lowered)
    spaced = _NON_ALNUM.sub(" ", no_apostrophes)
    return _WHITESPACE.sub(" ", spaced).strip()
