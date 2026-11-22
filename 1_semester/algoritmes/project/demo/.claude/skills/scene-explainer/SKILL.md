---
name: scene-explainer
description: Use when asked for an animated, step-through, visual, intuitive or 3Blue1Brown-style explainer page (HTML) that teaches how or why a code change, pull request, bug fix, algorithm or mechanism works, especially for someone new to the codebase.
---

# Scene Explainer

## Overview

A scene explainer is one self-contained HTML page the reader steps through with Next. Each step shows one idea as a picture with a short caption; code appears beside the picture only after the idea is understood.

**Core principle:** the picture carries the idea, and every code line and number on the page comes from a source, never from memory.

## When to use

- "Explain this change like a 3Blue1Brown video", "make an intuitive / animated / interactive explainer", "walk me through it visually".
- Teaching one change or one mechanism to someone new to the code.

Not for: a quick summary in chat, a line-by-line diff review, a diagram of a whole architecture.

## Workflow

1. **Pin the scope.** Name the commit range, the files and the reader. If several changes touch the same files, say which one the page covers.
2. **Collect facts before drawing.** Read the diff. Pick one real running example and write down its real values. List every number you plan to show with its source.
3. **Storyboard.** Read [references/storyboard.md](references/storyboard.md). Write the chapters and steps as a list before any HTML.
4. **Write the page.** Copy `assets/template.html` next to an `explainer.json`. Replace the example scenes, `CH` and `BEATS`. Keep the style block and the engine script as they are.
5. **Build.** `python3 scripts/build.py explainer.json`. It pulls the snippets from git, flags added lines, and fails on a missing anchor, an unknown snippet id, a syntax error or an external resource.
6. **Check in a real browser.** `bash scripts/check.sh page.html shots/`. Open every `sheet_*.png` and look at each step. Fix and rerun until the sheets are clean and the error list is empty.
7. **Report.** Give the full path, the chapters, the checks you ran, what the page leaves out, and offer to publish it.

Read [references/gotchas.md](references/gotchas.md) before step 4; it lists the mistakes that cost a rebuild.

## Quick reference

| In the template | Meaning |
|---|---|
| `data-scene="4-7"` on `.scene` | scene visible for steps 4 to 7 (steps count from 0) |
| `data-on="5"`, `"5-7"`, `"5+"` | fade the element in for those steps |
| `data-run="5-6"` | add `.run` on entering that range; restarts CSS animations |
| `class="late" style="--d:1.5s"` | appear after a delay once it or an ancestor has `.run` |
| `class="grow"` | bar that grows from the left when shown |
| `class="scene html"` | free-height HTML scene (cards, playground, numbers) |
| `{ch, cap, code:[ids], legend:[[colour,label]]}` | one step in `BEATS` |
| `HOOKS = {9: fn}` | run `fn` when step 9 is entered |
| `marks: [["text","new"]]` in explainer.json | highlight a substring; classes `new`, `c1`, `c2`, `c3`, `ink` |

## What a finished page has

- 15 to 25 steps in 4 to 7 chapters, in the order: puzzle, why it happened, the idea, try it, the code, the result, did it work.
- Captions of at most three plain sentences.
- One interactive playground that runs a port of the real logic, including look-alikes it must refuse.
- One colour per concept, the same in picture, legend and code.
- A known-limits step.
- No external resources; works at 390px wide; every step correct when opened directly by `#n`.

## Common mistakes

| Mistake | Fix |
|---|---|
| Typing code into the page | Add a snippet to explainer.json; `build.py` is the only source of code |
| Trusting a headless screenshot | It fires before animations finish; use `check.sh` |
| Showing code in the first chapters | Move it after the playground |
| A number without a source | Find the source or drop the number |
| Playground logic written from the description | Port the real function and test it with `node` |
| Viewing 20 screenshots one by one | View the contact sheets |
