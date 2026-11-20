"""Content-based ranking with an anonymous viewer's real interaction history."""

from collections import Counter
import math

EVENTS = {"open", "complete", "like", "unlike", "skip"}


def vocabulary(items, include_topic=True):
    docs = {}
    for m in items:
        tokens = {tag.casefold() for tag in m["tags"]}
        if include_topic:
            tokens.add(m["topic"].casefold())
        docs[m["id"]] = tokens
    frequency = Counter(t for tokens in docs.values() for t in tokens)
    return {
        mid: {t: math.log((1 + len(items)) / (1 + frequency[t])) + 1 for t in tokens}
        for mid, tokens in docs.items()
    }


def affinity(a, b, vectors):
    u, v = vectors[a["id"]], vectors[b["id"]]
    dot = sum(x * v.get(t, 0) for t, x in u.items())
    norm = math.sqrt(sum(x * x for x in u.values()) * sum(x * x for x in v.values()))
    semantic = dot / norm if norm else 0.0
    color = sum(min(x, y) for x, y in zip(a["hist"], b["hist"])) / 3
    motion = max(0, 1 - 5 * abs(a["motion"] - b["motion"]))
    return 0.65 * semantic + 0.25 * color + 0.10 * motion


def rank(items, states, views):
    vectors = vocabulary(items)
    outputs = []
    by_id = {m["id"]: m for m in items}
    signals = []
    for state in states.values():
        weight = (
            -4
            if state["skipped"]
            else state["opened"] + 2 * state["completed"] + 4 * state["liked"]
        )
        if weight and state["item"] in by_id:
            signals.append((by_id[state["item"]], weight))
    for idx, m in enumerate(items):
        mid = m["id"]
        state = states.get(mid, {})
        weighted = [
            (affinity(m, ref, vectors) * w, ref, w)
            for ref, w in signals
            if ref["id"] != mid
        ]
        taste = sum(row[0] for row in weighted) / max(
            1, sum(abs(row[2]) for row in weighted)
        )
        pop = min(math.log1p(views.get(mid, 0)) / 10, 1)
        score = taste + 0.12 * pop - 0.45 * state.get("opened", 0)
        reason = (
            "Khám phá từ thư viện."
            if not views.get(mid)
            else "Đã có người xem trong thư viện."
        )
        positive = [r for r in weighted if r[2] > 0]
        if positive:
            _, ref, _ = max(positive, key=lambda r: r[0])
            shared = sorted(
                set([m["topic"], *m["tags"]]) & set([ref["topic"], *ref["tags"]])
            )
            reason = (
                f"Cùng nét “{shared[0]}”" if shared else "Gần về màu sắc và chuyển động"
            ) + f" với “{ref['title']}” bạn đã tương tác."
        outputs.append(
            (
                {
                    **m,
                    "liked": bool(state.get("liked")),
                    "skipped": bool(state.get("skipped")),
                    "views": views.get(mid, 0),
                    "reason": reason,
                },
                score,
                idx,
            )
        )
    return [m for m, score, idx in sorted(outputs, key=lambda row: (-row[1], row[2]))]
