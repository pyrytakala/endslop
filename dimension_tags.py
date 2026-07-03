"""Derive highlight tags from dimension scores (only exceptional values)."""

from __future__ import annotations

POSITIVE_RULES: list[tuple[str, float, str]] = [
    ("substance", 8.5, "Very strong substance"),
    ("evidence", 8.5, "Strong evidence"),
    ("specificity", 9.0, "Very specific"),
    ("insight_density", 8.5, "High insight density"),
    ("non_promotion", 9.5, "Not promotional"),
]

NEGATIVE_RULES: list[tuple[str, float, str]] = [
    ("substance", 5.5, "Weak substance"),
    ("evidence", 4.5, "Weak evidence"),
    ("specificity", 6.0, "Hand-wavy"),
    ("insight_density", 5.5, "Low insight density"),
    ("non_promotion", 4.5, "High promo"),
]


def dimension_tags(video: dict) -> list[dict[str, str]]:
    tags: list[dict[str, str]] = []

    for field, minimum, label in POSITIVE_RULES:
        value = video.get(field)
        if value is not None and value >= minimum:
            tags.append({"label": label, "tone": "positive"})

    for field, maximum, label in NEGATIVE_RULES:
        value = video.get(field)
        if value is not None and value <= maximum:
            tags.append({"label": label, "tone": "negative"})

    return tags
