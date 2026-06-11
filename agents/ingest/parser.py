"""Parse the Comprehensive Rules .txt into per-rule chunks.

Structure of the CR body (after a table of contents):

    1. Game Concepts            <- top-level section header
    100. General                <- rule-group header
    100.1. These Magic rules... <- a rule
    100.1a A two-player game... <- a subrule
    Example: ...                <- continuation of the previous rule

We emit one chunk per numbered rule/subrule, attaching any following
non-numbered lines (e.g. "Example:") to that chunk. Headers set the `section`.
Parsing stops at the Glossary. Re-running is idempotent (keyed on ruleNumber).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Matches a rule/subrule line: 100.1, 100.1a, 601.2a, 702.19e ...
_RULE = re.compile(r"^(\d{1,3}\.\d+[a-z]?)\.?\s+(.+)$")
# Matches a header line: "1. Game Concepts" or "100. General"
_HEADER = re.compile(r"^(\d{1,3})\.\s+(.+)$")
# Effective-date line → used as rulesVersion.
_EFFECTIVE = re.compile(r"effective as of\s+(.+?)\.", re.IGNORECASE)


@dataclass
class RuleChunk:
    ruleNumber: str
    section: str
    text: str
    rulesVersion: str


def _extract_version(text: str) -> str:
    match = _EFFECTIVE.search(text)
    return match.group(1).strip() if match else "unknown"


def parse_rules(raw: str) -> list[RuleChunk]:
    rules_version = _extract_version(raw[:4000])
    lines = raw.splitlines()

    chunks: list[RuleChunk] = []
    current_section = ""
    current: RuleChunk | None = None
    started = False

    def flush() -> None:
        nonlocal current
        if current is not None:
            current.text = current.text.strip()
            if current.text:
                chunks.append(current)
        current = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Stop before the (real) Glossary / Credits trailer — but only once we've
        # entered the body, since these words also appear in the table of contents.
        if started and stripped.lower() in {"glossary", "credits"}:
            flush()
            break

        rule_match = _RULE.match(stripped)
        if rule_match:
            flush()
            started = True
            current = RuleChunk(
                ruleNumber=rule_match.group(1),
                section=current_section,
                text=rule_match.group(2),
                rulesVersion=rules_version,
            )
            continue

        header_match = _HEADER.match(stripped)
        if header_match:
            flush()
            current_section = f"{header_match.group(1)}. {header_match.group(2)}"
            continue

        # Continuation line (e.g. "Example: ...") for the current rule.
        if current is not None:
            current.text += "\n" + stripped

    flush()
    return chunks
