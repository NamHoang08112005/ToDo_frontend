"""Offline catalog retrieval check. Run with python -m pipeline.evaluate CATALOG.json."""

from collections import Counter
import json
from pathlib import Path
import argparse
from recommender import vocabulary, affinity


def evaluate(items, k=3):
    k = min(k, len(items) - 1)
    if k < 1:
        raise ValueError("Cần ít nhất hai mục")
    # Withhold the target topic and tags that literally repeat the topic labels.
    labels = {m["topic"].casefold() for m in items}
    queries = [
        {**m, "tags": [t for t in m["tags"] if t.casefold() not in labels]}
        for m in items
    ]
    vectors = vocabulary(queries, include_topic=False)
    counts = Counter(m["topic"] for m in queries)
    results = []
    for q in queries:
        others = [m for m in queries if m["id"] != q["id"]]
        nearest = sorted(others, key=lambda m: -affinity(q, m, vectors))[:k]
        hits = sum(m["topic"] == q["topic"] for m in nearest)
        results.append(
            {"query": q["id"], "nearest": [m["id"] for m in nearest], "hits": hits}
        )
    return {
        "k": k,
        "queries": len(items),
        "precision": sum(r["hits"] for r in results) / (len(items) * k),
        "chance": sum((counts[m["topic"]] - 1) / (len(items) - 1) for m in items)
        / len(items),
        "rows": results,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "catalog", type=Path, help="JSON catalog with items and visual descriptors"
    )
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    print(json.dumps(evaluate(catalog["items"]), indent=2))
