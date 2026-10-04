# zakpruitt.github.io

My personal site: who I am, where I've worked, and what I've built.

Live at **https://zakpruitt.github.io**

Plain HTML, CSS, and a little JS with no build step.

```
index.html                  the page
assets/style.css            styles + light/dark palette (mint & emerald)
assets/main.js              scroll reveal + theme toggle
assets/logos/               company logos
assets/me.svg               placeholder headshot (swap for a real photo)
scripts/sync-projects.mjs   rebuilds the projects section from repo READMEs
.github/workflows/          deploys to Pages on push and daily
```

## Projects sync

The projects section is generated. Any public repo whose README contains a
`portfolio` block shows up on the site; the block is an HTML comment, so it's
invisible on GitHub:

```html
<!-- portfolio
section: main
name: JBay
year: 2026
tags: Java 21, eBay API, OAuth
summary: A lightweight Java client for eBay's REST APIs.
  Longer summaries can wrap onto indented lines.
-->
```

| Field     | Default                  | Notes                                       |
|-----------|--------------------------|---------------------------------------------|
| `section` | `main`                   | `featured` (wide card), `main`, or `more` (compact list) |
| `name`    | repo name                |                                             |
| `year`    | year the repo was created | any text, e.g. `College`                   |
| `summary` | repo description         |                                             |
| `tags`    | none                     | comma-separated                             |
| `live`    | repo homepage            | `none` hides the Live link                  |
| `image`   | first local image in the README, else a screenshot of the live site | repo path or URL; `none` for no picture |
| `order`   | none                     | lower numbers first; otherwise newest first |

Screenshots are only taken when `CHROME` points at a Chrome binary (the workflow sets it);
they land in `assets/projects/`, which is gitignored.

The Deploy workflow runs the sync on every push, once a day, and on demand
(Actions → Deploy → Run workflow), then publishes to Pages. To refresh
`index.html` locally:

```
GITHUB_TOKEN=$(gh auth token) node scripts/sync-projects.mjs
python -m http.server
```
