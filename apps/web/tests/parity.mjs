// Structural parity check against the single-file prototype (Reader v4.1).
// For every passage it serializes the Chinese text, the Vietnamese text, the footnotes and the
// English text (tags, classes, clause group, entity, mention index, text) in both readers and
// reports the first difference.
//
//   node tests/parity.mjs path/to/dvsktt-reader-v4.1.html http://localhost:3000/ky-nha-dinh
import { chromium } from 'playwright';

const [proto, url] = process.argv.slice(2);
const exe = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

const SER = () => {
  const SKIP = new Set(['lit', 'eh', 'eon', 'eflash', 'flash']);
  const ser = (n) => {
    if (n.nodeType === 3) return n.nodeValue;
    if (n.nodeType !== 1) return '';
    const cls = [...n.classList].filter((c) => !SKIP.has(c)).sort().join('.');
    const a = ['g', 's', 'm', 'ent', 'c', 'n'].map((k) => (n.dataset[k] != null ? `${k}=${n.dataset[k]}` : '')).filter(Boolean).join(',');
    return `<${n.tagName.toLowerCase()}${cls ? '.' + cls : ''}${a ? '[' + a + ']' : ''}>${[...n.childNodes].map(ser).join('')}</>`;
  };
  return ser;
};

async function grab(page, sel) {
  return page.evaluate(([s, f]) => {
    const ser = eval(f)();
    return Object.fromEntries([...document.querySelectorAll('#sheet .entry')].map((e) => {
      const x = e.querySelector(s.zh), v = e.querySelector(s.vi), n = e.querySelector(s.fns);
      return [e.id, { zh: x ? ser(x) : '', vi: v ? ser(v) : '', fns: n ? ser(n) : '' }];
    }));
  }, [sel, `(${SER.toString()})`]);
}

const p1 = await browser.newPage();
await p1.goto('file://' + proto);
await p1.evaluate(() => window.__dvsktt.setLang('vi'));
const a = await grab(p1, { zh: '.zh', vi: '.vi', fns: '.fns' });
await p1.evaluate(() => window.__dvsktt.setLang('en'));
const aEn = await grab(p1, { zh: '.zh', vi: '.vi', fns: '.none' });

const p2 = await browser.newPage();
await p2.goto(url);
await p2.waitForFunction(() => window.__dvsktt);
const b = await grab(p2, { zh: '.zh', vi: '.vi[data-tl="vi"]', fns: '.fns' });
const bEn = await grab(p2, { zh: '.zh', vi: '.vi[data-tl="en"]', fns: '.none' });

let diffs = 0, checked = 0;
if (process.env.SHOW) console.log(JSON.stringify(b.E01).slice(0, 900), Object.values(b).reduce((n, x) => n + x.zh.length + x.vi.length + x.fns.length, 0));
const cmp = (label, x, y) => {
  checked++;
  if (x === y) return;
  diffs++;
  let i = 0; while (i < x.length && x[i] === y[i]) i++;
  if (diffs <= 8) console.log(`DIFF ${label} at ${i}\n  proto: …${x.slice(Math.max(0, i - 80), i + 120)}\n  next:  …${y.slice(Math.max(0, i - 80), i + 120)}`);
};
for (const id of Object.keys(a)) {
  if (!b[id]) { console.log('missing passage', id); diffs++; continue; }
  cmp(`${id} zh`, a[id].zh, b[id].zh);
  cmp(`${id} vi`, a[id].vi, b[id].vi);
  cmp(`${id} footnotes`, a[id].fns, b[id].fns);
  cmp(`${id} en`, aEn[id].vi, bEn[id].vi);
}
console.log(`${Object.keys(a).length} passages, ${checked} blocks compared, ${diffs} differences`);
await browser.close();
process.exit(diffs ? 1 : 0);
