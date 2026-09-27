"""Add a standalone HTML page under /pages/<slug>/ and rebuild the /pages/ index.

Usage:
  python pages/_publish.py add SOURCE.html SLUG --description "One sentence."
  python pages/_publish.py index

SOURCE may be a full HTML document or an artifact-style fragment (no <html>/<head>/<body>);
fragments are wrapped in a document skeleton. Jekyll skips this file because of its leading underscore.
"""
import argparse
import datetime
import html
import pathlib
import re
import sys

PAGES = pathlib.Path(__file__).resolve().parent

HEAD_TAGS = re.compile(r"<title>.*?</title>|<link\b[^>]*>|<meta\b[^>]*>|<style\b.*?</style>", re.S | re.I)

# Mirrors the reset the artifact host injects, so pages render the same as on claude.ai.
RESET = """<style>
:root{color-scheme:light}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#fbfbfa}
img{max-width:100%}
[hidden]{display:none!important}
</style>"""


def wrap(src, description, created):
    if re.search(r"<html\b", src, re.I):
        doc = src
    else:
        # Pull the leading head-type tags (title, fonts, styles) out of the fragment.
        head, pos = [], 0
        for m in HEAD_TAGS.finditer(src):
            if src[pos:m.start()].strip():
                break
            head.append(m.group(0))
            pos = m.end()
        doc = (
            "<!doctype html>\n<html lang=\"en\">\n<head>\n"
            "<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            + RESET + "\n" + "\n".join(head)
            + "\n</head>\n<body>\n" + src[pos:].strip() + "\n</body>\n</html>\n"
        )
    extra = [
        "<meta name=\"robots\" content=\"noindex\">",
        f"<meta name=\"description\" content=\"{html.escape(description)}\">",
        f"<meta name=\"created\" content=\"{created}\">",
    ]
    doc = re.sub(r"<meta name=\"(robots|description|created)\"[^>]*>\n?", "", doc)
    return re.sub(r"(<head[^>]*>\n?)", lambda m: m.group(1) + "\n".join(extra) + "\n", doc, count=1, flags=re.I)


def meta(doc, name):
    m = re.search(rf"<meta name=\"{name}\" content=\"([^\"]*)\"", doc)
    return html.unescape(m.group(1)) if m else ""


def build_index():
    items = []
    for f in sorted(PAGES.glob("*/index.html")):
        doc = f.read_text(encoding="utf8")
        t = re.search(r"<title>(.*?)</title>", doc, re.S)
        items.append((meta(doc, "created"), f.parent.name, html.unescape(t.group(1).strip()) if t else f.parent.name, meta(doc, "description")))
    items.sort(reverse=True)
    rows = "\n".join(
        f"<li><a href=\"{slug}/\">{html.escape(title)}</a><span>{created}</span><p>{html.escape(desc)}</p></li>"
        for created, slug, title, desc in items
    )
    (PAGES / "index.html").write_text(INDEX.replace("__ROWS__", rows).replace("__COUNT__", str(len(items))), encoding="utf8")
    print(f"index: {len(items)} page(s)")


INDEX = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Pages</title>
<style>
:root{--bg:#f6f6f4;--ink:#1c1d21;--muted:#666a73;--line:#dcdcd8;--accent:#2f45c9}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#131418;--ink:#e9e9ec;--muted:#9a9ca6;--line:#2b2d34;--accent:#8c9bff}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding-inline:16px}
main{max-width:720px;margin:0 auto;padding-block:40px}
h1{font-size:28px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 24px}
ul{list-style:none;margin:0;padding:0}
li{padding:14px 0;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr auto;gap:2px 12px}
li a{color:var(--accent);font-weight:600;text-decoration:none}
li a:hover{text-decoration:underline}
li span{color:var(--muted);font:13px ui-monospace,Menlo,monospace}
li p{grid-column:1/-1;margin:0;color:var(--muted)}
</style>
</head>
<body>
<main>
<h1>Pages</h1>
<p class="sub">__COUNT__ reference pages. Portfolio lives at <a href="/">the home page</a>.</p>
<ul>
__ROWS__
</ul>
</main>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add")
    a.add_argument("source")
    a.add_argument("slug")
    a.add_argument("--description", required=True)
    a.add_argument("--created", default=datetime.date.today().isoformat())
    sub.add_parser("index")
    args = ap.parse_args()
    if args.cmd == "add":
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args.slug):
            sys.exit("slug must be lowercase words joined by hyphens, e.g. chicago2-voice-guide")
        out = PAGES / args.slug / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(wrap(pathlib.Path(args.source).read_text(encoding="utf8"), args.description, args.created), encoding="utf8")
        print(f"wrote {out.relative_to(PAGES.parent)}")
    build_index()


if __name__ == "__main__":
    main()
