import json
from pathlib import Path

from match import best_match
from nb import word_helpers
from words import MODELS, UNIT, distance, load_levels

OUT = Path(__file__).resolve().parent / "t3"
OUT.mkdir(exist_ok=True)
h = word_helpers((14,))
levels = load_levels()
query = levels[0][0]
text = "".join(word for level in range(1, 7) for word in levels[level])
print(f"Query: {query} | Search text: {len(text)} characters")
assert best_match("cat", "xxcutyy") == (1, 2, 5)
assert best_match("a", "b") == (1, 0, 1)
result = {"query": query, "length": len(text)}
for model in ("unit", "weighted+swap"):
    sub, swap = MODELS[model]
    matcher = lambda q, s: (lambda c, a, b: (c / UNIT, a, b))(*best_match(q, s, sub, swap, UNIT))
    hits = h["top_five"](query, text, matcher)
    for cost, start, end, content in hits:
        assert abs(distance(query, content, model) / UNIT - cost) < 1e-9
    print("==", model)
    h["print_hits"](hits)
    result[model] = [{"cost": c, "start": a, "end": b, "text": t} for c, a, b, t in hits]
(OUT / "T3.json").write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
