import sys
from datetime import datetime, timezone
from pathlib import Path

HW = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HW))
from HW9_helpers import draw_png, load_points, load_tour

tour_file = Path(sys.argv[1])
when = datetime.now(timezone.utc)
output = tour_file.with_name(f"{when:%Y-%m-%d_%H-%M-%S}_UTC_{tour_file.stem}.png")
draw_png(load_points(HW / "HW9_TSP_2000.txt"), output, tour=load_tour(tour_file), name="Ruslan Nechshadimov", timestamp=when)
print(output)
