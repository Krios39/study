import random

ELITE = 1
MUTATION_RATE = 1 / 50
MUTATION_SCALE = 0.1


def student_ga(run, population, *, seed=0, progress=None):
    rng = random.Random(seed)
    bounds = run.bounds
    members = [list(member) for member in population]
    scores = []
    for member in members:
        if run.remaining <= 0:
            return
        scores.append(run(member))
    run.snapshot()
    size = len(members)
    circles = len(bounds) // 7

    def tournament():
        a, b = rng.sample(range(size), 2)
        return members[a] if scores[a] <= scores[b] else members[b]

    while run.remaining > 0:
        order = sorted(range(size), key=scores.__getitem__)
        next_members = [members[i] for i in order[:ELITE]]
        next_scores = [scores[i] for i in order[:ELITE]]
        while len(next_members) < size and run.remaining > 0:
            first, second = tournament(), tournament()
            child = []
            for circle in range(circles):
                parent = first if rng.random() < 0.5 else second
                child.extend(parent[7 * circle:7 * circle + 7])
            for k, (low, high) in enumerate(bounds):
                if rng.random() < MUTATION_RATE:
                    child[k] = min(max(child[k] + rng.gauss(0, MUTATION_SCALE * (high - low)), low), high)
            next_members.append(child)
            next_scores.append(run(child))
            if progress is not None:
                progress(run)
        members, scores = next_members, next_scores
        size = len(members)
