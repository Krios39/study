# Design specification: University of Tartu style

A working specification for web pages and demos built in the visual style of the University of Tartu. It combines the rules of the official style guide with the concrete values used in the timetabling demo (`1_semester/algoritmes/project/demo`).

## Sources

- Official style guide: https://stiiliraamat.ut.ee/en/
  - Colours: https://stiiliraamat.ut.ee/en/varvid/pohivarvid/
  - Combining colours: https://stiiliraamat.ut.ee/en/varvid/varvide-kombineerimine/
  - Typography: https://stiiliraamat.ut.ee/en/en-design-principles/fontide-kasutamine/
  - Rectangle and base grid: https://stiiliraamat.ut.ee/en/en-design-principles/ristkulik-ja-alusraamistik/
- The university website as a reference for web layout: https://ut.ee/en

Where this document says "style guide", the rule comes from the official guide. Everything else is a decision made for our pages and can be changed.

## Principles

1. Signature blue carries the page. It must appear on every designed surface, as a background or as a text colour.
2. Flat rectangles. No rounded cards, no pills, no shadows, no gradients as decoration.
3. Typography does the work. Large bold headings and comfortable body text replace boxes, badges and small grey labels.
4. Content sits directly on white. Sections are separated by space and thin rules, not by bordered containers.
5. Solid colour blocks for anything that must stand out: header, navigation, verdicts, footer.
6. Accent colours stay small and are never used for text.

## Colour

### Core palette (style guide)

| Token | Name | HEX | Use |
|---|---|---|---|
| `--brand` | Signature blue | `#2C5697` | Header, primary buttons, links, active elements |
| `--brand-dark` | Dark blue | `#1B365D` | Navigation strip, footer, headings, tooltips |
| `--brand-mid` | Medium blue | `#517DB9` | The angled rectangle, secondary surfaces |
| `--brand-light` | Light blue | `#96C8E6` | Accent colour in the dark theme |
| — | Orange accent | `#FF5725` | At most 10% of a surface, never for text |
| — | Purple accent | `#78439E` | At most 10% of a surface, never for text |
| — | Dark grey | `#333333` | Body text instead of pure black |
| — | Grey | `#666666` | Secondary text |
| — | Light grey | `#CCCCCC` | Thin rules |
| — | White | `#FFFFFF` | Page background |

### Rules for combining colours (style guide)

- When several blues are used, signature blue takes the largest share.
- On signature, medium and dark blue backgrounds only white text is allowed.
- On white and light blue backgrounds text is signature blue, dark blue or dark grey.
- Pure black is not used for text.
- Only one of the two accent colours is used on a surface.

### Supporting colours

The core palette has no colours for states, so these are taken from the faculty and outer-circle palettes of the style guide.

| Token | HEX (light) | HEX (dark) | Meaning |
|---|---|---|---|
| `--good` | `#4F6A1F` | `#C3DC91` | Allowed, kept, improved |
| `--bad` | `#C42E3B` | `#F0A6AB` | Not allowed, undone, rule broken |
| `--warn` | `#8F6333` | `#EDB87D` | Warning, comparison line |

### Theme tokens

| Token | Light | Dark |
|---|---|---|
| `--bg`, `--surface` | `#FFFFFF` | `#10213B` |
| `--ink` | `#333333` | `#FFFFFF` |
| `--muted` | `#666666` | `#C9D6E8` |
| `--line` | `#CCCCCC` | `#3F5F8F` |
| `--allowed` (flat tinted block) | `#E8EDF4` | `#24447A` |
| `--accent` | `#2C5697` | `#96C8E6` |
| `--on-accent` | `#FFFFFF` | `#1B365D` |
| `--head` (headings) | `#1B365D` | `#FFFFFF` |
| `--shade` (outlines on data marks) | `#1B365D` | `#0B1729` |

The header, navigation strip and footer keep their blue backgrounds in both themes.

### Contrast

All text pairs meet WCAG AA (4.5:1). Measured values: dark grey on white 12.6, grey on white 5.7, white on signature blue 7.3, signature blue on white 7.3, green 6.2, red 5.5, brown 5.3. In the dark theme the lowest pair is 6.2.

## Typography

- Typeface: **Rubik** for headings and body text (style guide). Fallback: Arial.
- Headings use Rubik Medium or Bold, body text Rubik Regular (style guide).
- Fonts are embedded in the page so it works offline.

| Element | Size | Weight | Colour |
|---|---|---|---|
| Page title in the header | 40 px (28 px on phones) | 700 | white |
| Subtitle in the header | 19 px | 400 | white |
| Section question / wizard heading | 36 px (28 px on phones) | 700 | `--head` |
| Step heading | 30 px (24 px on phones) | 700 | `--head` |
| Large numbers | 38 px | 700 | `--head` |
| Body text | 17 px (16 px on phones), line height 1.5 | 400 | `--ink` |
| Secondary text | 14–15 px | 400 | `--muted` |
| Buttons, navigation | 16–17 px | 500 | — |

Avoid text smaller than 14 px outside charts and dense data marks. Do not use uppercase labels or letter-spacing as decoration.

## Shape

- The rectangle is the main design element after the logo (style guide). It is straight or tilted by 15 degrees and extends beyond the edge of the surface.
- Corner radius is 0 everywhere except interactive controls (buttons, selects, steppers), which use 4 px, as on ut.ee.
- No shadows. No decorative gradients. No borders around content blocks.
- Thin rules are 1 px in `--line`. Emphasis rules (progress, step indicator, active tab) are 5–6 px in a solid colour.

## Layout

- Page padding: 40 px on wide screens, 16 px on phones.
- Wide screens: content column plus a 340 px side block, 44 px apart.
- Below 860 px: a single column, playback controls fixed to the bottom of the screen.
- Forms and wizards sit in a centred column of at most 800 px.
- The page must not scroll sideways at 390 px.

## Components

### Header

A full-width signature blue block with white text. A medium blue rectangle tilted by 15 degrees sits in the top right corner and runs off the edge. The title is 40 px bold, the subtitle 19 px, a white underlined link below.

### Navigation

A full-width dark blue strip directly under the header. Items are plain white text, 56 px tall, each with a bold number in front. The active item is a white block with dark blue text. On a white background the same items are dark blue text with a 5 px underline on the active one. Disabled items are shown at 40% opacity.

### Buttons

- Primary: solid `--accent` background, text in `--on-accent`, 46 px tall, 4 px radius, weight 500. Hover turns the background dark blue.
- Secondary: white background, 2 px `--accent` border, `--accent` text.
- The main forward button of a wizard is 56 px tall and ends with an arrow.
- Toggle groups are two or more secondary buttons joined edge to edge; the selected one is solid.

### Form controls

Selects are 46 px tall with a 2 px `--accent` border and 4 px radius. Choice tiles are flat squares: unselected in `--allowed` with dark blue text, selected in solid `--accent` with white text. Steppers are 38 px square outline buttons around a bold number.

### Content blocks

- Lists are rows at least 58 px tall, separated by 1 px rules, with the label in weight 500 and details in 14 px grey.
- The side block is one flat `--allowed` rectangle. Figures inside it are plain rows: a 15 px label and a 38 px bold number, separated by a thin rule.
- Step indicators are equal segments with a 6 px top rule: grey for upcoming, `--accent` for current, dark blue for done.

### Message blocks

Messages that the reader must not miss are solid rectangles with white text: signature blue for neutral or positive, brown `#8F6333` for a warning, red `#C42E3B` for an error. The first line is 21 px bold.

### Links on blue

A link block on a blue background has no fill: a 1 px white border at 55% opacity, white text, the call to action underlined. Hover raises the border to full white and adds a 12% white tint.

### Tooltips

A flat dark blue rectangle with white 14 px text, no arrow, no radius, no shadow.

### Footer

A full-width dark blue block with white 15 px text and 34 px vertical padding.

## Data colours in the timetable

These are encodings of data, not part of the brand palette, and they stay as they are.

- A lesson is coloured by the difficulty of its subject: `hsl(H 80% 58%)`, with the hue running from 125 (green, easiest) to 0 (red, hardest). Labels on lessons are dark `#14161A`.
- The lesson being decided is solid `--accent` with a 2 px `--shade` outline.
- An allowed place is a green tint with a dot; a forbidden place is a red tint with a cross.
- A lesson in a poor place carries a dark triangle in its top right corner.
- Every state has a shape as well as a colour, so the picture does not depend on colour vision.

## What to avoid

- Bordered or shadowed cards and "dashboard" grids of stat tiles.
- Pill shapes, circular number badges, tinted callouts with a coloured left border.
- Small grey text as the default voice of the page.
- Accent orange or purple as a text colour or as a large surface.
- Pure black text, and any text other than white on a blue background.
- More than one accent colour on the same surface.

## Logo

The university logo has its own rules in the style guide (clear space, permitted colours, units and partnerships) and its use may need approval from the Marketing and Communication Office. The demo pages do not use it. A copy of the English primary logo lies in this folder as `ingliskeelne_pohilogo_lk8-1-scaled.png`.
