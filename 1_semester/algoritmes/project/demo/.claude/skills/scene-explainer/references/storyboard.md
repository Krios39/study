# Storyboard: what goes in which step

The reader is new to the code. They can stop at any step and should have understood everything so far.

## The order that works

| # | Chapter | What the reader sees | Code shown? |
|---|---|---|---|
| 1 | The puzzle | The thing going wrong, drawn with its real colours, sizes or numbers. Then the wrong result the product gave | no |
| 2 | Why it happened | The mechanism as a journey: one thing travels through the system and gets stopped. Show a normal case passing first, then the failing case | no |
| 3 | The idea | The rule in plain words: 2 to 4 conditions, each with the reason it exists | no |
| 4 | Try it | A playground running the real logic on the real case and on look-alikes that must be refused | no |
| 5 | The code | One file per chapter, in the order the data flows. Each step shows a few lines beside a picture of what they do | yes |
| 6 | The result | The verdict or output after the change, on the same example as chapter 1 | no |
| 7 | Did it work | Measured numbers with their source, then what it still does not handle, then a one-screen recap | no |

- 15 to 25 steps in 4 to 7 chapters. One idea per step.
- The same running example appears in chapters 1, 2, 4 and 6. Use its real values (a real hex colour, a real pixel size, a real line of JSON).
- Code first appears after the reader has already used the idea. Then every colour in the code matches a colour in the picture.

## Captions

- At most three sentences. Plain words. No term the reader has not met; when a term is needed, define it in the same sentence.
- Say what happens and why. Leave the "how" to the picture.
- The first step states the puzzle. The last step states the whole change in two sentences.
- Mark measured facts with where they come from ("in two weeks of logs"). Leave out anything you cannot source.

## Pictures

- One colour per concept, used the same way in the picture, the legend and the code highlights.
- Real values: if the bug is a 23% cache hit rate against an 80% target, draw a bar that stops at 23 and a line at 80.
- A journey needs a contrast pair: one case that goes through, one that is stopped, with the reason written at the place it stops.
- When a step explains "who can see what", draw the tree and circle what each node can see.

## The playground

- Port the real decision function into the page's script, and name it after the original.
- Offer the real case first, then 4 to 6 look-alikes, each failing a different condition. Include one known gap, shown honestly as "not caught".
- Show one light per condition with the reason in words, and a one-line verdict.
- Let the reader flip one property by clicking.
- Check the port outside the browser: run it with `node` on every preset and compare with what the real code returns for the same inputs.

## Sizing the code steps

- 1 to 3 snippets per step, at most about 25 lines in total. Long functions get their own step.
- Highlight the few words that matter with `marks`; whole added lines are already green.
- A one-word change deserves its own step with the caption saying so ("the whole fix is one changed operator").
