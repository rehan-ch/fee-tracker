// Turns docs/PRIVACY_POLICY.md and docs/DELETE_ACCOUNT.md into the static pages
// served by GitHub Pages from /docs. No dependencies. Run: node scripts/build-pages.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const PAGES = [
  { src: 'docs/PRIVACY_POLICY.md', out: 'docs/privacy-policy.html' },
  { src: 'docs/DELETE_ACCOUNT.md', out: 'docs/delete-account.html' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

function render(md) {
  const lines = md.split('\n');
  const out = [];
  let para = [];
  let list = null;
  let table = null;
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`), (para = []);
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`), (list = null);
    if (table) {
      const [head, ...rows] = table;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') +
          '</tbody></table>',
      );
      table = null;
    }
  };
  let title = '';
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      flush();
      if (h[1].length === 1) title = h[2];
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (/^_.*_$/.test(line)) {
      flush();
      out.push(`<p class="meta">${inline(line.slice(1, -1))}</p>`);
      continue;
    }
    if (/^\|/.test(line)) {
      if (/^\|[\s-|]+\|$/.test(line)) continue;
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (!table) flush(), (table = []);
      table.push(cells);
      continue;
    }
    const li = /^(-|\d+\.) (.*)$/.exec(line);
    if (li) {
      const tag = li[1] === '-' ? 'ul' : 'ol';
      if (para.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push(li[2]);
      continue;
    }
    if (/^\s+\S/.test(raw) && list) {
      list.items[list.items.length - 1] += ' ' + line.trim();
      continue;
    }
    if (line === '') {
      flush();
      continue;
    }
    if (table) flush();
    para.push(line);
  }
  flush();
  return { title, body: out.join('\n') };
}

const CSS = `
:root{color-scheme:light;--ink:#1f2937;--muted:#6b7280;--accent:#0F766E;--line:#e5e7eb;--bg:#F4F6F8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 16px 64px;background:#fff}
@media(min-width:760px){main{margin:32px auto;border-radius:16px;padding:40px 48px 64px}}
h1{font-size:1.75rem;line-height:1.25;margin:0 0 .25rem}h2{font-size:1.2rem;margin:2rem 0 .5rem;color:var(--accent)}h3{font-size:1.05rem;margin:1.5rem 0 .5rem}
p{margin:.5rem 0}.meta{color:var(--muted);font-size:.9rem;margin-bottom:1.5rem}
ul,ol{padding-inline-start:1.4rem}li{margin:.25rem 0}a{color:var(--accent)}code{background:var(--bg);padding:0 .3em;border-radius:4px}
table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.95rem}th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}
nav{font-size:.9rem;margin-bottom:1.5rem}nav a{margin-inline-end:1rem}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
`;

const nav = `<nav><a href="./">Fee Tracker</a><a href="privacy-policy.html">Privacy policy</a><a href="delete-account.html">Delete account</a></nav>`;
const footer = `<footer>Fee Tracker is published by Rehan Ch · <a href="mailto:nexondev.ai@gmail.com">nexondev.ai@gmail.com</a></footer>`;

for (const { src, out } of PAGES) {
  const { title, body } = render(readFileSync(src, 'utf8'));
  writeFileSync(
    out,
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${esc(title)}</title>\n<style>${CSS}</style>\n</head>\n<body>\n<main>\n${nav}\n${body}\n${footer}\n</main>\n</body>\n</html>\n`,
  );
  console.log(`${src} -> ${out}`);
}
