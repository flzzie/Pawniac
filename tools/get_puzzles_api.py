#!/usr/bin/env python3
"""SMALL puzzle maker (no big download, no extra packages).

Asks the Lichess puzzle API for hard puzzles (long mates + calculation themes) and writes
lichess_puzzles.js in the folder you run it from. Takes about a minute.

In PyCharm: put this in a .py file, click Run. Then attach lichess_puzzles.js.
"""
import json, os, sys, time, urllib.request, urllib.error

OUT = os.path.join(os.getcwd(), "lichess_puzzles.js")
# Optional, makes Lichess allow many more requests: lichess.org > your profile > Preferences > API access tokens >
# "+" > give it any name, tick NOTHING > Create > copy the token and paste it between the quotes.
TOKEN = ""
# (theme, kind). Long mates first, then non-obvious calculation themes.
ANGLES = [("mateIn5", "mate"), ("mateIn4", "mate"),
          ("sacrifice", "calc"), ("quietMove", "calc"), ("deflection", "calc"), ("attraction", "calc"),
          ("clearance", "calc"), ("interference", "calc"), ("intermezzo", "calc"),
          ("defensiveMove", "calc"), ("zugzwang", "calc"), ("exposedKing", "calc")]
LEVELS = ("normal", "harder", "hardest")   # a spread, so not every puzzle is brutal
BAD = {"mateIn1", "mateIn2", "mateIn3", "oneMove", "short"}


def fetch(angle, difficulty):
    url = "https://lichess.org/api/puzzle/batch/%s?nb=50&difficulty=%s" % (angle, difficulty)
    hdr = {"Accept": "application/json", "User-Agent": "pawniac-puzzle-maker"}
    if TOKEN.strip():
        hdr["Authorization"] = "Bearer " + TOKEN.strip()
    req = urllib.request.Request(url, headers=hdr)
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print("    Lichess says slow down, waiting 70 s...", flush=True); time.sleep(70); continue
            print("    HTTP", e.code, "for", angle); return None
        except Exception as e:
            print("    problem:", e); time.sleep(3)
    return None


def convert(item, kind):
    p, g = item.get("puzzle") or {}, item.get("game") or {}
    sol, themes = p.get("solution") or [], p.get("themes") or []
    if not g.get("pgn") or len(sol) < 3 or set(themes) & BAD:
        return None
    return {"i": p.get("id"), "p": g["pgn"], "s": sol, "r": p.get("rating", 0), "t": " ".join(themes), "k": kind}


def save(got):
    if not got:
        return
    try:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write("window.PAWNIAC_LICHESS_PGN = " + json.dumps(sorted(got.values(), key=lambda x: x["r"]), separators=(",", ":")) + ";\n")
    except OSError:
        pass


def collect(fetcher=fetch, sleep=time.sleep):
    got = {}
    for angle, kind in ANGLES:
        for diff in LEVELS:
            data = fetcher(angle, diff)
            n0 = len(got)
            for item in (data or {}).get("puzzles", []):
                c = convert(item, kind)
                if c and c["i"] not in got:
                    got[c["i"]] = c
            print("%-14s %-8s +%d  (total %d)" % (angle, diff, len(got) - n0, len(got)), flush=True)
            save(got)                      # keep what we have so far, even if we get stopped
            sleep(6)
    return sorted(got.values(), key=lambda x: x["r"])


def main():
    out = collect()
    if not out:
        sys.exit("\nNo puzzles came back. Check your internet connection and try again.")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.PAWNIAC_LICHESS_PGN = " + json.dumps(out, separators=(",", ":")) + ";\n")
    print("\nDONE: %d puzzles" % len(out))
    print("File written to:", OUT)
    print("Attach that file in the chat.")


if __name__ == "__main__":
    main()
