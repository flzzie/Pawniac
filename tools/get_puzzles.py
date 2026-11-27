#!/usr/bin/env python3
"""ONE-CLICK puzzle maker. Open this file in PyCharm and press Run.

It downloads the free Lichess puzzle database (about 250 MB), keeps only hard puzzles
(mate in 4-5 and long, non-obvious calculation puzzles) and writes lichess_puzzles.js
next to this script's working folder. Then send that file (a few hundred KB) back.

If PyCharm says "No module named zstandard": click the yellow bar > Install package,
or open the Terminal tab at the bottom and run:   pip install zstandard
"""
import csv, io, json, os, random, sys, urllib.request

URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
OUT = os.path.join(os.getcwd(), "lichess_puzzles.js")
WANT = 400                      # how many puzzles to keep
LO, HI = 1900, 2800             # rating range
BAN = {"mateIn1", "mateIn2", "mateIn3", "oneMove", "short"}
MATE = {"mateIn4", "mateIn5"}
CALC = {"sacrifice", "quietMove", "deflection", "attraction", "clearance", "interference",
        "intermezzo", "defensiveMove", "zugzwang", "exposedKing", "trappedPiece"}


def open_zstd(raw):
    """Return a binary file object that decompresses the stream."""
    try:
        import zstandard
        return zstandard.ZstdDecompressor().stream_reader(raw)
    except ImportError:
        pass
    try:
        from compression import zstd          # built into Python 3.14+
        return zstd.ZstdFile(raw)
    except ImportError:
        pass
    sys.exit("\nMissing helper. In PyCharm's Terminal tab run:  pip install zstandard\nthen press Run again.")


def filter_rows(text_file):
    pools = {"mate": {}, "calc": {}}
    seen = 0
    for row in csv.DictReader(text_file):
        seen += 1
        if seen % 500000 == 0:
            print("  read", seen, "puzzles...", flush=True)
        try:
            r = int(row["Rating"]); pop = int(row["Popularity"]); plays = int(row["NbPlays"])
        except (ValueError, KeyError):
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
    return pools


def choose(pools):
    random.seed(11)
    pick = []
    for kind, share in (("mate", 0.4), ("calc", 0.6)):
        bands = pools[kind]
        if not bands:
            continue
        per = max(1, int(WANT * share) // len(bands))
        for b in sorted(bands):
            random.shuffle(bands[b]); pick += bands[b][:per]
    pick.sort(key=lambda p: p["r"])
    return pick


def main():
    print("Downloading from Lichess (about 250 MB, this takes a few minutes)...", flush=True)
    req = urllib.request.Request(URL, headers={"User-Agent": "pawniac-puzzle-maker"})
    with urllib.request.urlopen(req) as resp:
        text = io.TextIOWrapper(open_zstd(resp), encoding="utf-8", newline="")
        pools = filter_rows(text)
    pick = choose(pools)
    with open(OUT, "w", encoding="utf-8") as o:
        o.write("window.PAWNIAC_LICHESS = " + json.dumps(pick, separators=(",", ":")) + ";\n")
    print("\nDONE:", len(pick), "puzzles (" + str(sum(p["k"] == "mate" for p in pick)) + " long mates,",
          str(sum(p["k"] == "calc" for p in pick)) + " calculation)")
    print("File written to:", OUT)
    print("Send me that file.")


if __name__ == "__main__":
    main()
