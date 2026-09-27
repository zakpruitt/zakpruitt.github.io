---
name: publish-page
description: Publish a standalone HTML reference page (research lists, guides, lookup tools, often first made as a claude.ai artifact) to this GitHub Pages site under /pages/<slug>/, apart from the portfolio. Use when Zak asks to add, deploy, host or publish an HTML page or artifact to his site / GitHub Pages, or to update or remove one already under pages/.
---

# Publish a page to zakpruitt.github.io/pages/

This repo is Zak's GitHub Pages site (served from `master`, repo root, legacy Jekyll build).
The root `index.html`, `assets/`, `images/` and `.old/` are the **portfolio — never touch them** for this workflow.
Everything for these pages lives under `pages/`:

```
pages/
  _publish.py            # wraps a page + rebuilds the index (underscore => Jekyll doesn't publish it)
  index.html             # GENERATED list of all pages; never hand-edit
  <slug>/index.html      # one folder per page -> https://zakpruitt.github.io/pages/<slug>/
```

## What these pages are

Self-contained, single-file HTML pages: research compilations and lookup tools Zak uses in real life
(example: `chicago2-voice-guide`, a searchable voice-role list for convention guests).
They are public but marked `noindex` so they don't show up in search next to the portfolio.
They must work as static files: inline CSS/JS/data, fonts from Google Fonts, scripts only from public CDNs,
no server, no build step, no `window.claude` runtime APIs.

## Steps

1. **Get the source HTML.**
   - If it's a claude.ai artifact from this session, use the local file that was published.
   - If it's an artifact link, read it with the Artifact tool (`action: "read"`) and use the saved file.
   - If building a new page, follow the `artifact-design` guidance and write it as an artifact-style fragment
     (a `<title>`, `<link>`/`<style>` tags, then body content). Full documents also work.
   - Check it has no `window.claude` calls or artifact-only capabilities. If it does, tell Zak which features
     won't work on GitHub Pages before continuing.
2. **Pick a slug**: lowercase words joined by hyphens, specific to the subject (`chicago2-voice-guide`,
   not `guide` or `page1`). If `pages/<slug>/` already exists, this is an update: reuse the same slug and pass
   the original `--created` date (read it from the existing file's `<meta name="created">`).
3. **Run the script** from the repo root:
   ```
   python pages/_publish.py add <source.html> <slug> --description "One plain sentence about what the page is."
   ```
   It wraps fragments in a full document (charset, viewport, a reset matching the artifact host),
   adds `robots noindex`, `description` and `created` meta tags, writes `pages/<slug>/index.html`,
   and regenerates `pages/index.html`. After deleting a page folder, run `python pages/_publish.py index`.
4. **Check** `git status`: only paths under `pages/` (and this skill) should have changed.
5. **Commit and push to `master`** — pushing is the deploy. Zak has asked for this workflow to deploy,
   so commit and push when he asks to add/publish a page. Message style: `pages: add <slug>` / `pages: update <slug>`.
6. **Report the URL**: `https://zakpruitt.github.io/pages/<slug>/` (the index is `https://zakpruitt.github.io/pages/`).
   GitHub Pages takes a minute or two to rebuild; `gh api repos/zakpruitt/zakpruitt.github.io/pages/builds/latest`
   shows the build status if Zak wants confirmation.

## Rules

- Never commit personal or sensitive data into a page. Everything here is public, even if noindexed.
  If a page contains private info (addresses, finances, other people's details), stop and ask Zak first.
- Don't add CI, Jekyll config, `.nojekyll` or other site-wide changes for this workflow unless asked;
  they could affect the portfolio.
- Keep each page in one file. If a page truly needs extra assets, put them inside its own `pages/<slug>/` folder.
