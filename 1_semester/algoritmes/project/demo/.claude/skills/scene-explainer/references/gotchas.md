# Gotchas

## Checking the page

| Symptom | Cause | Do this |
|---|---|---|
| Screenshot shows half-faded content, counters mid-way, empty caption | `chrome --headless --screenshot` captures about 100ms after load, even with `--virtual-time-budget` or `--timeout` | Use `bash scripts/check.sh`, which drives a real browser session and waits per step |
| Phone screenshot is desktop width | Chrome's window has a minimum width; `agent-browser viewport` is not the command | `agent-browser set viewport 390 844` (check.sh does this) |
| Animation end states look wrong only when a step is opened directly | The element relies on a class from an earlier step | Every step must be correct when opened by `#n`; put the state on `data-on` / `data-run` ranges |

Look at the contact sheets yourself. A page with no console errors can still have overlapping labels.

## SVG

| Symptom | Cause | Do this |
|---|---|---|
| Console: `<rect> attribute rx: Expected length` | Four corner radii on a rect | SVG takes one `rx`; draw an arch with `<path d="M.. V.. a r r 0 0 1 w 0 V.. Z">` |
| Indented code or JSON lines start at the same x | SVG collapses leading spaces | Indent with the `x` attribute per line |
| Text in a `<g class="mono">` is not monospace | `svg text{font-family}` beats the inherited value | The template sets `svg .mono text`; put font classes on the group or the text, not on an outer wrapper |
| Arrowheads missing in some scenes | The `<marker>` sits in a scene that is hidden | Keep the one shared marker in the zero-size svg at the top of `<body>` |
| A moving token jumps to the origin | CSS `transform` replaces the `transform` attribute | Position with an outer `<g transform="translate(x,y)">`, animate an inner `<g>` |
| A bar grows from its centre | Default transform origin | Use class `grow` (`transform-box:fill-box; transform-origin:left center`) |
| Token snaps back when moving to the next step | `data-run` ended, so `.run` was removed | Give `data-run` the whole range it should stay in its end state, e.g. `6-7` |

## Layout

- The stage is 16:9 for svg scenes. Html scenes (`class="scene html"`) set their own height; do not put tall html in an svg scene.
- At phone width the svg keeps a 640px width and scrolls sideways inside the stage. The page itself must not scroll sideways: check `pageWidth == viewport` in check.sh output.
- With a code panel, the caption and buttons must come before the code on phones (the template orders them); check `nextAboveCode: true`.
- Long code lines wrap. Do not shorten or reflow real code to make it fit.
- Labels that sit under narrow boxes overlap; use a single symbol or add a gap.

## Motion

- Stagger with `transition-delay` on `data-on` elements, or `class="late"` with `--d` for animations.
- Keep each step's motion under about 7 seconds; the reader presses Next when ready.
- `prefers-reduced-motion` turns animation off; any element that only becomes visible through an animation needs its end state in that media query (the template covers `late` and `travel`).
- Set the first caption without the fade, or the first paint shows an empty caption.

## Honesty

- Code lines come from `build.py` only. If a line is too long, show it wrapped.
- A number in a picture or caption needs a source you can name: a test, a query, a changelog line, a formula you ran.
- A playground that disagrees with the real function is worse than none. Test the port.
