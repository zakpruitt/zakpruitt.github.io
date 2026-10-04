// Rebuilds the projects section of index.html from `<!-- portfolio ... -->` blocks in each repo's README.
// Set CHROME to a Chrome binary to screenshot live sites for projects without an image.

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const USER = "zakpruitt";
const PAGE = new URL("../index.html", import.meta.url);
const START = "<!-- projects:start -->";
const END = "<!-- projects:end -->";
const SECTIONS = ["featured", "main", "more"];

export function parseBlock(readme) {
  const block = readme.match(/<!--\s*portfolio\b([\s\S]*?)-->/)?.[1];
  if (!block) return null;

  const fields = {};
  let key;
  for (const line of block.split(/\r?\n/)) {
    const pair = line.match(/^\s*([a-z]+):\s*(.*)$/);
    if (pair) {
      key = pair[1];
      fields[key] = pair[2].trim();
    } else if (key && line.trim()) {
      fields[key] += ` ${line.trim()}`;
    }
  }
  return fields;
}

const isUrl = (src) => /^(https?:)?\/\//.test(src);

export function readmeImage(readme) {
  for (const [, markdown, html] of readme.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)|<img[^>]*\ssrc="([^"]+)"/g)) {
    const src = markdown ?? html;
    if (!isUrl(src)) return src;
  }
  return null;
}

function resolveImage(repo, src) {
  if (!src || isUrl(src)) return src;
  return `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${src.replace(/^\.?\//, "")}`;
}

export function toProject(repo, fields, readme = "") {
  const section = fields.section ?? "main";
  if (!SECTIONS.includes(section)) {
    throw new Error(`${repo.name}: unknown section "${section}"`);
  }
  const live = fields.live === "none" ? null : fields.live ?? (repo.homepage || null);
  const image = fields.image === "none" ? null : resolveImage(repo, fields.image ?? readmeImage(readme));
  return {
    slug: repo.name.toLowerCase(),
    name: fields.name ?? repo.name,
    section,
    year: fields.year ?? repo.created_at.slice(0, 4),
    summary: fields.summary ?? repo.description ?? "",
    tags: fields.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [],
    live,
    image,
    screenshot: !image && fields.image !== "none" && Boolean(live),
    source: repo.html_url,
    order: Number(fields.order ?? Infinity),
  };
}

const escape = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const indent = (html, spaces) =>
  html.split("\n").map((line) => (line ? " ".repeat(spaces) + line : line)).join("\n");

function card(p) {
  const links = [
    p.live && `<a href="${escape(p.live)}" target="_blank">Live ↗</a>`,
    `<a href="${escape(p.source)}" target="_blank">Source ↗</a>`,
  ].filter(Boolean);
  const tags = p.tags.map((t) => `<li>${escape(t)}</li>`).join("");

  const image = p.image
    ? `
  <img class="shot" src="${escape(p.image)}" alt="Screenshot of ${escape(p.name)}" loading="lazy">`
    : "";

  return `<article class="card${p.section === "featured" ? " featured" : ""} reveal">${image}
  <header class="row">
    <h3>${escape(p.name)}</h3>
    <span class="meta">${escape(p.year)}</span>
  </header>
  <p>${escape(p.summary)}</p>${tags ? `\n  <ul class="tags">${tags}</ul>` : ""}
  <footer>
    ${links.join("\n    ")}
  </footer>
</article>`;
}

function listItem(p) {
  return `<li>
  <header class="row">
    <a href="${escape(p.live ?? p.source)}" target="_blank">${escape(p.name)}</a>
    <span class="meta">${escape(p.year)}</span>
  </header>
  <p>${escape(p.summary)}</p>
</li>`;
}

export function render(projects) {
  const sorted = projects.toSorted((a, b) =>
    SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) ||
    a.order - b.order ||
    (Number(b.year) || 0) - (Number(a.year) || 0) ||
    a.name.localeCompare(b.name));

  const cards = sorted.filter((p) => p.section !== "more").map(card);
  const more = sorted.filter((p) => p.section === "more").map(listItem);

  let html = `<div class="grid">\n${indent(cards.join("\n\n"), 2)}\n</div>`;
  if (more.length) {
    html += `\n\n<h3 class="subhead reveal">More projects</h3>
<ul class="more reveal">\n${indent(more.join("\n"), 2)}\n</ul>`;
  }
  return html;
}

export function inject(page, html) {
  const start = page.indexOf(START);
  const end = page.indexOf(END);
  if (start < 0 || end < start) throw new Error("projects markers not found in index.html");

  const lineStart = page.lastIndexOf("\n", start) + 1;
  const pad = page.slice(lineStart, start);
  return `${page.slice(0, start + START.length)}\n${indent(html, pad.length)}\n${pad}${page.slice(end)}`;
}

async function github(path, accept = "application/vnd.github+json") {
  const headers = { Accept: accept };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(`https://api.github.com${path}`, { headers });
}

async function fetchProjects() {
  const res = await github(`/users/${USER}/repos?per_page=100&type=owner`);
  if (!res.ok) throw new Error(`listing repos failed: ${res.status}`);
  const repos = (await res.json())
    .filter((r) => !r.fork && !r.private && r.name !== `${USER}.github.io`);

  const projects = await Promise.all(repos.map(async (repo) => {
    const readme = await github(`/repos/${USER}/${repo.name}/readme`, "application/vnd.github.raw");
    if (!readme.ok) return null;
    const text = await readme.text();
    const fields = parseBlock(text);
    return fields && toProject(repo, fields, text);
  }));
  return projects.filter(Boolean);
}

export async function captureScreenshots(projects, chrome) {
  const dir = new URL("../assets/projects/", import.meta.url);
  await mkdir(dir, { recursive: true });

  await Promise.all(projects.filter((p) => p.screenshot).map(async (p) => {
    const file = `assets/projects/${p.slug}.png`;
    try {
      await promisify(execFile)(chrome, [
        "--headless=new",
        "--hide-scrollbars",
        "--window-size=1280,800",
        "--virtual-time-budget=8000",
        `--screenshot=${fileURLToPath(new URL(`${p.slug}.png`, dir))}`,
        p.live,
      ]);
      p.image = file;
    } catch (err) {
      console.warn(`screenshot failed for ${p.name}: ${err.message}`);
    }
  }));
}

async function main() {
  const projects = await fetchProjects();
  if (!projects.length) {
    console.warn("no repos have a portfolio block; leaving index.html alone");
    return;
  }
  if (process.env.CHROME) await captureScreenshots(projects, process.env.CHROME);

  const page = await readFile(PAGE, "utf8");
  const updated = inject(page, render(projects));
  if (updated === page) {
    console.log("projects already up to date");
    return;
  }
  await writeFile(PAGE, updated);
  console.log(`synced ${projects.length} projects: ${projects.map((p) => p.name).join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
