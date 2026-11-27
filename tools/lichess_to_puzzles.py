#!/usr/bin/env python3
"""Turn the Lichess puzzle database into js/lichess_puzzles.js (hard calculation puzzles only).

  1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst  (free, CC0)
  2. zstd -d lichess_db_puzzle.csv.zst
  3. python3 tools/lichess_to_puzzles.py lichess_db_puzzle.csv js/lichess_puzzles.js [count]

Keeps only:
  * "mate"  - mate in 4 or 5 (Lichess themes mateIn4 / mateIn5): long forced mates, never obvious
  * "calc"  - long, non-obvious solutions: sacrifice / quiet move / deflection / attraction /
              clearance / interference / intermezzo / defensive move / zugzwang with 3+ of your own moves
Never: mate in 1-3, one-move puzzles, easy ratings, unpopular or rarely played puzzles.

Each entry: {i:id, f:FEN before the opponent's first move, m:"uci uci ...", r:rating, t:"themes", k:"mate"|"calc"}
m[0] is the opponent's move that creates the puzzle; you then find m[1], m[3], ...; replies are m[2], m[4], ...
"""
import csv, sys, json, random
src, out = sys.argv[1], sys.argv[2]
want = int(sys.argv[3]) if len(sys.argv) > 3 else 400
BAN = {"mateIn1", "mateIn2", "mateIn3", "oneMove", "short"}
MATE = {"mateIn4", "mateIn5"}
CALC = {"sacrifice", "quietMove", "deflection", "attraction", "clearance", "interference",
        "intermezzo", "defensiveMove", "zugzwang", "exposedKing", "trappedPiece"}
LO, HI = 1900, 2800
pools = {"mate": {}, "calc": {}}
with open(src, newline="") as fh:
    for row in csv.DictReader(fh):
        try:
            r = int(row["Rating"]); pop = int(row["Popularity"]); plays = int(row["NbPlays"])
        except ValueError:
            continue
        if not (LO <= r <= HI) or pop < 88 or plays < 500:
            continue
        th = set(row["Themes"].split())
        if th & BAN:
            continue
        n = len(row["Moves"].split())
        if th & MATE:
            kind = "mate"
        elif th & CALC and n >= 7 and ("long" in th or "veryLong" in th):
            kind = "calc"
        else:
            continue
        pools[kind].setdefault((r - LO) // 100, []).append(
            {"i": row["PuzzleId"], "f": row["FEN"], "m": row["Moves"], "r": r, "t": row["Themes"], "k": kind})
random.seed(11)
pick = []
for kind, share in (("mate", 0.4), ("calc", 0.6)):
    bands = pools[kind]
    if not bands:
        continue
    per = max(1, int(want * share) // len(bands))
    for b in sorted(bands):
        random.shuffle(bands[b]); pick += bands[b][:per]
pick.sort(key=lambda p: p["r"])
with open(out, "w") as o:
    o.write("window.PAWNIAC_LICHESS = " + json.dumps(pick, separators=(",", ":")) + ";\n")
print(len(pick), "puzzles:", sum(p["k"] == "mate" for p in pick), "long mates,", sum(p["k"] == "calc" for p in pick), "calculation")
