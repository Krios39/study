import random


def student_de(run, population, *, F=0.8, CR=1.0, seed=0):
    rng = random.Random(seed)
    bounds = run.bounds
    members = [list(member) for member in population]
    scores = []
    for member in members:
        if run.remaining <= 0:
            return
        scores.append(run(member))
    size = len(members)
    while run.remaining > 0:
        snapshot = [member[:] for member in members]
        for target in range(size):
            if run.remaining <= 0:
                return
            r1, r2, r3 = rng.sample([i for i in range(size) if i != target], 3)
            donor = [min(max(snapshot[r1][k] + F * (snapshot[r2][k] - snapshot[r3][k]), low), high)
                     for k, (low, high) in enumerate(bounds)]
            forced = rng.randrange(len(bounds))
            trial = [donor[k] if k == forced or rng.random() < CR else snapshot[target][k]
                     for k in range(len(bounds))]
            score = run(trial)
            if score <= scores[target]:
                members[target], scores[target] = trial, score


def student_jde(run, population, *, F=0.8, CR=0.7, seed=0, tau=0.1, F_range=(0.1, 1.0)):
    rng = random.Random(seed)
    bounds = run.bounds
    members = [list(member) for member in population]
    size = len(members)
    factors = [F] * size
    rates = [CR] * size
    trace = run.settings.setdefault("adaptation", [])
    scores = []
    for member in members:
        if run.remaining <= 0:
            return
        scores.append(run(member))
    while run.remaining > 0:
        trace.append({"evaluation": run.evaluations, "mean_F": sum(factors) / size, "mean_CR": sum(rates) / size})
        snapshot = [member[:] for member in members]
        for target in range(size):
            if run.remaining <= 0:
                return
            f = rng.uniform(*F_range) if rng.random() < tau else factors[target]
            cr = rng.random() if rng.random() < tau else rates[target]
            r1, r2, r3 = rng.sample([i for i in range(size) if i != target], 3)
            donor = [min(max(snapshot[r1][k] + f * (snapshot[r2][k] - snapshot[r3][k]), low), high)
                     for k, (low, high) in enumerate(bounds)]
            forced = rng.randrange(len(bounds))
            trial = [donor[k] if k == forced or rng.random() < cr else snapshot[target][k]
                     for k in range(len(bounds))]
            score = run(trial)
            if score <= scores[target]:
                members[target], scores[target] = trial, score
                factors[target], rates[target] = f, cr
