#!/usr/bin/env python3
"""Turn the Lichess puzzle database into js/puzzle_data.js.

  1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst  (free, CC0)
  2. zstd -d lichess_db_puzzle.csv.zst
  3. python3 tools/lichess_to_puzzles.py lichess_db_puzzle.csv js/lichess_puzzles.js [count]

Each entry: {i:id, f:FEN before the opponent's first move, m:"uci uci ...", r:rating, t:"themes"}
m[0] is the opponent's move that creates the puzzle; the player then finds m[1], replies come from m.
"""
import csv, sys, json, random
src, out = sys.argv[1], sys.argv[2]
want = int(sys.argv[3]) if len(sys.argv) > 3 else 400
SKIP = {"mateIn1", "mateIn2", "oneMove", "veryLong"}
LO, HI = 1700, 2700
by_band = {}
with open(src, newline="") as fh:
    for row in csv.DictReader(fh):
        try:
            r = int(row["Rating"]); pop = int(row["Popularity"]); plays = int(row["NbPlays"])
        except ValueError:
            continue
        if not (LO <= r <= HI) or pop < 90 or plays < 1000:
            continue
        th = set(row["Themes"].split())
        if th & SKIP:
            continue
        n = len(row["Moves"].split())
        if n < 4:          # need at least two of your own moves
            continue
        by_band.setdefault((r - LO) // 100, []).append(
            {"i": row["PuzzleId"], "f": row["FEN"], "m": row["Moves"], "r": r, "t": row["Themes"]})
random.seed(7)
per = max(1, want // len(by_band))
pick = []
for b in sorted(by_band):
    random.shuffle(by_band[b]); pick += by_band[b][:per]
pick.sort(key=lambda p: p["r"])
with open(out, "w") as o:
    o.write("window.PAWNIAC_LICHESS = " + json.dumps(pick, separators=(",", ":")) + ";\n")
print(len(pick), "puzzles written to", out)
