"""Coarse interaction categories for slicing eval results.

RulesGuru questions carry fine-grained, multi-label tags (e.g. "Layers",
"Triggered abilities"). For per-category dashboards we collapse those into a
small, fixed taxonomy and attach the result to each LangSmith dataset example's
metadata (see ``langsmith_eval._example_payload``). That lets the LangSmith
compare view **group experiment scores by ``metadata.category``** — no local
bucketing required.

Mapping is deterministic and priority-ordered: the FIRST category whose tag set
intersects a case's tags wins, so the most distinctive mechanic in a multi-tag
case decides its bucket.
"""

from __future__ import annotations

# Priority-ordered (most distinctive mechanic first).
CATEGORY_PRIORITY: list[tuple[str, set[str]]] = [
    (
        "Layers & continuous effects",
        {
            "Layers",
            "Continuous effects",
            "Type-changing effects",
            "Static abilities",
            "Dependency",
            "Characteristic-defining abilities",
            "Copy effects",
        },
    ),
    (
        "Replacement & prevention",
        {"Replacement effects", "Prevention"},
    ),
    (
        "Costs, casting & mana",
        {
            "Casting spells",
            "Alternative Costs",
            "Additional Costs",
            "Mana abilities",
            "Mana",
        },
    ),
    (
        "Triggers, abilities & the stack",
        {
            "Triggered abilities",
            "Activated abilities",
            "Resolving objects",
            "Abilities",
            "Last known information",
            "Targets",
        },
    ),
    (
        "Combat, zones & state",
        {
            "Combat",
            "Damage",
            "Zone-changes",
            "State-based actions",
            "Counters",
            "Evergreen keywords",
            "Non-evergreen keywords",
            "Auras",
            "Lands",
            "Drawing a card",
            "Tokens",
        },
    ),
]

# Cases with no recognised tag fall back to the broad "Combat, zones & state"
# bucket (it doubles as the catch-all of common, lower-distinctiveness mechanics).
FALLBACK_CATEGORY = "Combat, zones & state"

CATEGORY_NAMES: list[str] = [name for name, _ in CATEGORY_PRIORITY]


def categorize(tags: list[str] | None) -> str:
    """Map a case's RulesGuru tags to a single coarse category."""
    tagset = set(tags or [])
    for name, members in CATEGORY_PRIORITY:
        if tagset & members:
            return name
    return FALLBACK_CATEGORY
