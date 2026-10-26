HW9 2026: images, tours and geometric set cover (version 4, 2026-10-24)
========================================================================

START HERE
Extract HW9_data.zip and open HW9_Explorer_2026.ipynb in Colab or Jupyter.
In Colab upload HW9_data.zip when prompted; keeping it in Drive alone is not
enough. No Drive mount is required. Locally the ZIP should be beside the notebook.
Python dependencies: numpy, matplotlib, Pillow. Tour validation, SVG output
and point-only PNGs need only Python's standard library. Named tour PNGs use
Pillow and Matplotlib's bundled font. Only data and drawing/checking helpers are
provided: implement the assessed algorithms yourself.

FILES
HW9_TSP_100.txt, HW9_TSP_500.txt, HW9_TSP_2000.txt: id x y.
HW9_TSP_manifest.json: hashes, counts and spacing.
Matching PNG/SVG files show the point inputs.
HW9_helpers.py: point loading, generation, tour validation and PNG/SVG plotting.
HW9_experiment_helpers.py: images, row distances, assembly, geometry and cover checks.
HW9_Explorer_2026.ipynb: examples of using those functions.
HW9_small_examples.json, HW9_small_tours.png, HW9_small_cover.png: small illustrations.
HW9_rows_test_shuffled.png: the supplied worked-example image with rows shuffled.
HW9_rows_test_order.txt: the correct order of shuffled row indices (zero-based).
HW9_rows_test_info.json: dimensions and RGB-pixel hash for reconstruction checks.
  No original PNG is distributed; generate it yourself using the order file.
HW9_rows_challenge_shuffled.png: assessed mystery image; NO answer order or seed.
HW9_TSP_baseline_tour.txt, HW9_TSP_baseline_score.json: initial competition record.

Both shuffled images are included. Only the worked example has an answer order.
The older 1000-point and rental-station files in the repository are archival;
they are NOT used by this version and are NOT in the student ZIP.

POINTS, TREES AND TOURS
The smaller datasets are prefixes of the same frozen 2000-point master.
IDs are 1..N, coordinates integer 0..1999, pairwise separation at least 10.
Seed: 20261018. The published files and hashes, not a seed alone, define inputs.
The 100- and 2000-point files are byte-identical to version 1.
All point data and illustrations are original course-generated material.

The original point drawings use a 2000 x 2000 field, a 10-pixel dark frame
and 20-pixel white outer margin (2060 x 2060 total). These borders do not
enter distances. x points right and y down. Matplotlib examples auto-fit
the field and disks; their screen pixels are not extra coordinate data.

Your tour file contains whitespace-separated integer IDs, each exactly once,
WITHOUT repeating the start. The closing edge is included in scoring.
Your tree/graph edge file contains two vertex IDs per line, without a header.

python3 HW9_helpers.py validate HW9_TSP_2000.txt my_tour.txt --competition
python3 HW9_helpers.py plot HW9_TSP_2000.txt --tour my_tour.txt --name "Donald Duck" --output my_tour.png
python3 HW9_helpers.py plot HW9_TSP_100.txt --edges my_tree.txt --output my_tree.svg

Distances are ordinary Euclidean lengths, not squared or rounded per edge.
The validator uses math.fsum and reports a cycle hash invariant to rotation
and reversal. --competition also checks the frozen input hash.
The route file plus independent score is the checkable result; PNG is its
visual evidence. Improving the baseline does not change the input data.

TOUR IMAGE CAPTIONS
Replace "Donald Duck" with your own name. Every tour plot requires name=...
(or --name on the CLI). PNG, SVG and notebook plots recompute the closed-tour
length with the SAME validate_tour function; never supply a score as a label.
The caption has the form:
    Donald Duck, TSP-length: nnnnn.nnn
    YYYY-MM-DD HH:MM:SS UTC
Date/time is filled automatically when drawing. It is not a submission time
or evidence of priority: the Zulip post timestamp still determines record order.
The image rounds to three decimals; use full-precision validator JSON for scores.
Captioned PNG/SVG files add a header outside the unchanged data field. Names
wrap rather than being truncated. Example Python calls:
    H.draw_png(points, "my_tour.png", tour=my_tour, name="Donald Duck")
    H.draw_svg(points, "my_tour.svg", tour=my_tour, name="Donald Duck")
    E.draw_geometry(points, tour=my_tour, name="Donald Duck")
The optional Python timestamp argument accepts a timezone-aware datetime for
reproducible figures; normally omit it to use the current UTC time.

T3 uses every starting ID for each dataset, not just five: 2N fixed-MST tours
(ascending/descending child orders) and N NN tours. Reuse distances and the
fixed MST; pre-sorted neighbour lists can accelerate repeated NN starts.
Record all scores, best/worst starting IDs and routes, median, percentage
spread and total all-start runtime. Time preparation separately.

IMAGE ROWS
Rows use ZERO-based indices. shuffle_rows(image, seed) returns (shuffled, p),
where shuffled[j] = original[p[j]]. reconstruct_rows(shuffled, order) assembles
YOUR proposed permutation, not an inferred solution. row_distance_matrix
uses signed RGB differences and a wide sum; no uint8 overflow.
row_path_cost scores only consecutive rows, without a closing edge.
NN hint: the chain has two ends. At each step compare the best unused-row
extension at both ends and prepend/append the better match. Tie-break by row
index, then prefer prepending. Other similarity measures may be tested;
compare path scores only within the same measure. Neither helper finds the order.
The supplied order file is the INVERSE of p: original[y] = shuffled[order[y]].
For the worked example:

    shuffled = E.load_rgb("HW9_rows_test_shuffled.png")
    correct_order = np.loadtxt("HW9_rows_test_order.txt", dtype=int)
    original = E.reconstruct_rows(shuffled, correct_order)
    E.save_rgb(original, "HW9_example_restored.png")

Equivalently: original = shuffled[correct_order]. The notebook also verifies
SHA256 of the restored row-major uint8 RGB bytes against the supplied metadata.
The order file has one shuffled row index per output row, with no header.
This is a worked reconstruction procedure, not a search algorithm.

After trying your own ordering algorithm on the example, use
recovered_adjacencies(my_order, np.argsort(correct_order)) to evaluate it.
That inverse supplies the shuffle mapping expected by the checker.
It is orientation-independent: a vertical reversal scores 100%.

This example preserves the supplied image at full 1536 x 1024 resolution:
1024 whole rows are permuted, with no changes within rows. Never resize it
vertically after shuffling. The distance matrix uses all rows and may take
a few seconds. For smaller self-made experiments, resize BEFORE shuffling.
Use the example's known order to learn assembly and verify your own algorithm;
do not use it during the search.

The challenge preserves all 1672 x 940 pixels and permutes its 940 rows
independently. No challenge original, answer-order file or shuffle seed is
provided. Load HW9_rows_challenge_shuffled.png from the same data folder.
Save your best zero-based order (one row index per line), reconstruction and
all trial scores. Download the PNG; do not use a screenshot of a scaled preview.

GEOMETRIC COVERAGE
K is the target TOTAL membership including the centre: find K-1 other neighbours.
For N=100/500/2000 use K=10/50/100 in T4. Radius is that neighbourhood's maximum
distance. Include ALL points inside or on the disk, even additional boundary ties.
Do not symmetrise neighbour links or replace disks with graph-hop neighbourhoods.

Each candidate is identified by (centre_id, radius_squared). Its cost is
pi * radius_squared. The objective is the SUM of selected disk areas, not their
union area; overlaps are charged repeatedly and boundary clipping is not allowed.
squared_distances supplies numerical distances, not the k-NN selection.
disk_from_radius supplies geometric membership for a radius YOU chose.
check_cover recomputes membership and costs and returns valid/uncovered,
selected_count/total_area, and first-cover owner indices for plotting.
It rejects repeated disks or disks with fewer than ten members by default.
draw_cover uses the first selected covering disk for point colours. Colours
are only a display convention; a point can belong to multiple disks.

Greedy maximises newly covered points / area, updating every step. Skip zero
gain. Break ties by centre ID, then radius squared. T5 expands the candidate
family; B1 changes selection while holding that family fixed. Keep the full
candidate list and chosen disk dictionaries in your results so another person
can reproduce the comparison. Recompute an allegedly better cover's cost and
verify full coverage rather than relying on the plot.

COMPETITION: RULES, NOT YET OPEN
The HW9 page is the authoritative rule text. Opening requires the dedicated
Zulip channel link and closing date/time. The normal HW9 deadline is separate.
The ID-1 NN baseline in this ZIP is the initial record. The first complete,
valid result beating it earns 1p. Later records earn 1p when beating another
student's standing record; repeat wins after someone else leads are allowed.
Improving your own current record updates it without extra points.

Post: recomputed cost (at least six decimals), validator JSON, textual route
file, matching PNG labelled with your name/length/date-time, method/assistance
credits and link to the preceding record.
A complete new post's timestamp decides order; corrections need a new post.
Staff verify and confirm points; peer checking is welcome.
Improvement must exceed 0.000001. Equal/rotated/reversed cycles earn nothing.
No common runtime limit or fastest-machine tie-break applies. Reusing an open
route is allowed with credit; coordinated staged record exchanges are not.

MAINTAINERS
python3 HW9_helpers.py generate --output regenerated
Run teacher/hw9-validation.py --prepare to regenerate small worked examples
and the public baseline; then scripts/package-hw9.py to build the notebook/ZIP.
These maintenance commands need the scientific Python dependencies.
Never include teacher reference algorithms in the student bundle.
The originals and challenge answer order stay outside the student distribution.
