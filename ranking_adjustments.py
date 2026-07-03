"""Apply small ranking adjustments from cohort-relative metadata."""

from __future__ import annotations

DEFAULT_MAX_LIKE_ADJUSTMENT = 3.0


def index_videos_by_id(index_payload: dict) -> dict[str, dict]:
    return {video["id"]: video for video in index_payload.get("videos") or [] if video.get("id")}


def assign_like_ranks(results: list[dict]) -> None:
    ranked_by_likes = sorted(
        [result for result in results if result.get("like_count") is not None],
        key=lambda result: result["like_count"],
        reverse=True,
    )

    current_rank = 0
    previous_likes: int | None = None
    for result in ranked_by_likes:
        if result["like_count"] != previous_likes:
            current_rank += 1
            previous_likes = result["like_count"]
        result["like_rank"] = current_rank


def like_rank_adjustment(like_rank: int, max_rank: int, max_adjustment: float) -> float:
    if max_rank <= 1:
        return 0.0

    normalized = (max_rank - like_rank) / (max_rank - 1)
    return round((normalized - 0.5) * 2 * max_adjustment, 2)


def apply_like_rank_adjustment(
    results: list[dict],
    index_by_id: dict[str, dict],
    *,
    max_adjustment: float = DEFAULT_MAX_LIKE_ADJUSTMENT,
) -> list[dict]:
    scorable = [result for result in results if result.get("composite") is not None]

    for result in scorable:
        metadata = index_by_id.get(result["id"], {})
        result["like_count"] = metadata.get("like_count")
        result["upload_date"] = metadata.get("upload_date")
        result["composite_base"] = result["composite"]
        result.pop("like_rank", None)
        result.pop("like_adjustment", None)

    assign_like_ranks(scorable)
    ranked_with_likes = [result for result in scorable if result.get("like_rank") is not None]
    max_rank = max(result["like_rank"] for result in ranked_with_likes) if ranked_with_likes else 0

    for result in scorable:
        like_rank = result.get("like_rank")
        if like_rank is None:
            result["like_adjustment"] = 0.0
            continue

        adjustment = like_rank_adjustment(like_rank, max_rank, max_adjustment)
        result["like_adjustment"] = adjustment
        result["composite"] = round(result["composite_base"] + adjustment, 2)

    return sorted(scorable, key=lambda result: result["composite"], reverse=True)
