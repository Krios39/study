import json
from pathlib import Path

from words import MODELS, UNIT, distance, evaluation, search

OUT = Path(__file__).resolve().parent / "t2"
OUT.mkdir(exist_ok=True)
h = evaluation()
levels, originals = h["levels"], h["originals"]
counts, queries = {}, []
for model in MODELS:
    for level in h["test_levels"]:
        counts[f"{model} L{level}"] = h["evaluate"](search, model, level)
        print(model, level, counts[f"{model} L{level}"])
for level in h["test_levels"]:
    for row in h["query_rows"]:
        query, truth = levels[level][row], originals[row]
        entry = {"level": level, "row": row, "query": query, "truth": truth}
        for model in MODELS:
            winners = sorted(search(query, originals, model))
            entry[model] = {"winners": winners, "cost": distance(query, winners[0], model) / UNIT,
                            "truth_cost": distance(query, truth, model) / UNIT,
                            "outcome": h["outcome"](winners, truth)}
        queries.append(entry)
(OUT / "T2.json").write_text(json.dumps({"counts": counts, "queries": queries}, indent=1, ensure_ascii=False), encoding="utf-8")
for q in queries:
    marks = [q[m]["outcome"][:4] + f" {q[m]['truth_cost']:g}/{q[m]['cost']:g} {','.join(q[m]['winners'][:3])}" for m in MODELS]
    print(q["level"], q["row"], q["query"], "|", q["truth"], "|", " | ".join(marks))
