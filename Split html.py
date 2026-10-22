"""
split_html.py
Splits a big index.html into index.html + css/*.css + js/*.js
without changing behaviour, then (optionally) commits and pushes to GitHub.

HOW TO USE (PyCharm):
  1. Edit the SETTINGS section below.
  2. Run it once with DO_GIT = False and check the site still works.
  3. Set DO_GIT = True and run again (or just run git yourself).

Why it is safe:
  - Every inline <style> / <script> block is replaced in the SAME position
    by a <link> / <script src>, so load order and CSS cascade are unchanged.
  - Blocks are NOT merged (merging can change behaviour), each gets its own file.
  - Things it leaves alone: external scripts/styles, JSON / template /
    importmap / ld+json scripts, HTML comments, empty blocks.
"""

import re
import subprocess
from pathlib import Path

# ======================= SETTINGS =======================
REPO_DIR = r"C:\Users\rishi\PycharmProjects\chess"    # folder that contains index.html (your git repo)
HTML_FILE = "index.html"
CSS_DIR = "css"
JS_DIR = "js"
DO_GIT = False                           # True = git add / commit / push
COMMIT_MESSAGE = "Split index.html into separate CSS and JS files"
BRANCH = None                            # e.g. "main"; None = current branch
# ========================================================

PATTERN = re.compile(
    r"<!--.*?-->"                                   # HTML comment (kept as is)
    r"|<style\b([^>]*)>(.*?)</style\s*>"            # group 1,2
    r"|<script\b([^>]*)>(.*?)</script\s*>",         # group 3,4
    re.IGNORECASE | re.DOTALL,
)

JS_TYPES = {"", "text/javascript", "application/javascript", "module"}


def get_attr(attrs: str, name: str):
    m = re.search(rf"""\b{name}\s*=\s*("([^"]*)"|'([^']*)'|(\S+))""", attrs, re.I)
    if not m:
        return None
    return next(g for g in m.groups()[1:] if g is not None)


def strip_defer_async(attrs: str) -> str:
    # defer/async are ignored on inline scripts but would change order on external ones
    return re.sub(
        r"""\s+(?:defer|async)(?:\s*=\s*(?:"[^"]*"|'[^']*'|\S+))?(?=\s|$)""",
        "",
        attrs,
        flags=re.I,
    )


def main():
    repo = Path(REPO_DIR)
    html_path = repo / HTML_FILE
    if not html_path.exists():
        raise SystemExit(f"Cannot find {html_path}")

    original = html_path.read_text(encoding="utf-8")
    base = html_path.parent
    (base / CSS_DIR).mkdir(exist_ok=True)
    (base / JS_DIR).mkdir(exist_ok=True)

    written = []          # files created
    counters = {"css": 0, "js": 0}
    has_module = False

    def write_file(folder, prefix, ext, content):
        counters[ext] += 1
        name = f"{prefix}_{counters[ext]:02d}.{ext}"
        rel = f"{folder}/{name}"
        (base / folder / name).write_text(content.strip("\n") + "\n", encoding="utf-8")
        written.append(rel)
        return rel

    def replace(m):
        nonlocal has_module
        if m.group(0).startswith("<!--"):
            return m.group(0)

        # ---- <style> ----
        if m.group(2) is not None:
            attrs, css = m.group(1), m.group(2)
            if not css.strip():
                return m.group(0)
            t = (get_attr(attrs, "type") or "text/css").lower()
            if t != "text/css":
                return m.group(0)
            rel = write_file(CSS_DIR, "style", "css", css)
            media = get_attr(attrs, "media")
            media_attr = f' media="{media}"' if media else ""
            return f'<link rel="stylesheet" href="{rel}"{media_attr}>'

        # ---- <script> ----
        attrs, js = m.group(3), m.group(4)
        if get_attr(attrs, "src") is not None or not js.strip():
            return m.group(0)
        t = (get_attr(attrs, "type") or "").lower()
        if t not in JS_TYPES:
            return m.group(0)
        if t == "module":
            has_module = True
        rel = write_file(JS_DIR, "script", "js", js)
        clean = strip_defer_async(attrs)
        return f'<script{clean} src="{rel}"></script>'

    new_html = PATTERN.sub(replace, original)

    if not written:
        raise SystemExit("Nothing to split (no inline <style>/<script> blocks found).")

    html_path.write_text(new_html, encoding="utf-8")

    print(f"Original lines : {original.count(chr(10)) + 1}")
    print(f"New index.html : {new_html.count(chr(10)) + 1} lines")
    print(f"Files created  : {len(written)}")
    for f in written:
        print("  ", f)
    if has_module:
        print("\nNOTE: you have <script type=\"module\">. Browsers block these from "
              "file:// so test with a local server (python -m http.server) or GitHub Pages.")

    if DO_GIT:
        git_push(repo, [HTML_FILE, *written])
    else:
        print("\nDO_GIT is False, so nothing was committed. Test the page, then push.")


def run(cmd, cwd):
    print("$", " ".join(cmd))
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode != 0:
        raise SystemExit(f"Command failed: {' '.join(cmd)}")


def git_push(repo: Path, files):
    run(["git", "add", *files], repo)
    run(["git", "commit", "-m", COMMIT_MESSAGE], repo)
    push = ["git", "push"]
    if BRANCH:
        push += ["origin", BRANCH]
    run(push, repo)


if __name__ == "__main__":
    main()