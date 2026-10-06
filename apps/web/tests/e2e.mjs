// Browser tests for the Next.js reader (Playwright + Chromium), ported from the v4.1 prototype suite.
//   node tests/e2e.mjs [http://localhost:3000/ky-nha-dinh] [screenshot-dir]
// Set CHROMIUM_PATH to use a preinstalled Chromium instead of Playwright's download.
import path from 'node:path';
import { chromium } from 'playwright';

const URL_ = process.argv[2] || 'http://localhost:3000/ky-nha-dinh';
const SHOTS = process.argv[3] || null;
const results = []; let failed = 0;
const ok = (name, cond, info = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const origin = new URL(URL_).origin;

async function open(opts = {}) {
  const ctx = await browser.newContext(opts);
  await ctx.route((u) => !u.href.startsWith(origin), (r) => r.abort());   // no third-party requests
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.__dvsktt && window.__dvsktt.mentions != null && document.querySelectorAll('#sheet .entry').length > 0);
  return { ctx, page, errors };
}
const center = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const cardState = (page) => page.evaluate(() => ({ hidden: document.querySelector('#ecard').hidden, id: window.__dvsktt.card?.id ?? null, pinned: !!window.__dvsktt.card?.pinned,
  title: document.querySelector('#ecT')?.textContent, sheet: document.querySelector('#ecard').classList.contains('sheet') }));
const VI = '.vi[data-tl="vi"]';

// ---------------------------------------------------------------- desktop
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  const st = await page.evaluate(() => ({ placed: new Set([...document.querySelectorAll('#sheet .ent')].map((x) => x.dataset.m)).size, total: window.__dvsktt.mentions,
    nEnt: window.__dvsktt.entities, entries: document.querySelectorAll('#sheet .entry').length }));
  ok('44 passages rendered', st.entries === 44, `${st.entries} entries`);
  ok('every compiled mention is placed in the text', st.placed === st.total && st.total === 483, `${st.placed}/${st.total}`);
  ok('canonical entities loaded', st.nEnt === 104, `${st.nEnt}`);

  const zhSel = '#E01 .zh .ent[data-ent="person:dinh-bo-linh"]', viSel = `#E01 ${VI} .ent[data-ent="person:dinh-bo-linh"]`;
  const zhTxt = await page.$$eval(zhSel, (els) => els.map((x) => x.dataset.c)), viTxt = await page.locator(viSel).allTextContents();
  ok('E01 Chinese 部領 is interactive and resolves to person:dinh-bo-linh', zhTxt.join('') === '部領', JSON.stringify(zhTxt));
  ok('E01 Vietnamese "Bộ Lĩnh" is interactive and resolves to person:dinh-bo-linh', viTxt.join('') === 'Bộ Lĩnh', JSON.stringify(viTxt));
  const notWholeAlias = await page.evaluate(() => [...document.querySelectorAll('#E01 .zh .ent')].map((x) => x.dataset.c).join(''));
  ok('only mention-data spans are marked (諱 is not part of the entity)', !notWholeAlias.includes('諱'));

  let [x, y] = await center(page, zhSel);
  await page.mouse.move(x, y); await sleep(150);
  let s = await cardState(page);
  ok('hover has an intentional delay (no card after 150 ms)', s.hidden);
  await sleep(450); s = await cardState(page);
  ok('hover opens the card for Đinh Bộ Lĩnh', !s.hidden && s.id === 'person:dinh-bo-linh' && s.title === 'Đinh Bộ Lĩnh' && !s.pinned, JSON.stringify(s));
  const cardBox = await page.locator('#ecard').boundingBox(); const entBox = await page.locator(zhSel).first().boundingBox();
  const overlap = !(cardBox.x > entBox.x + entBox.width || cardBox.x + cardBox.width < entBox.x || cardBox.y > entBox.y + entBox.height || cardBox.y + cardBox.height < entBox.y);
  ok('card does not cover the entity', !overlap);
  const head = await page.evaluate(() => ({ zh: document.querySelector('.ec-zh')?.textContent, type: document.querySelector('.ec-type')?.textContent,
    aka: document.querySelector('.ec-aka')?.textContent, tabs: [...document.querySelectorAll('.ec-tabs button')].map((b) => b.textContent) }));
  ok('header: 丁部領, PERSON, also-known-as from the database', head.zh === '丁部領' && head.type === 'PERSON' && /部領/.test(head.aka) && /先皇帝/.test(head.aka) && /Tiên Hoàng/.test(head.aka), JSON.stringify(head));
  ok('tabs: Overview / In Toàn Thư / Relations / Occurrences (N) / Links', head.tabs.join('|') === 'Overview|In Toàn Thư|Relations|Occurrences (15)|Links', head.tabs.join(' | '));
  await page.mouse.move(cardBox.x + 40, cardBox.y + 30, { steps: 8 }); await sleep(600);
  s = await cardState(page); ok('moving from entity into the card does not close it', !s.hidden);
  await page.mouse.move(5, 880, { steps: 4 }); await sleep(600);
  s = await cardState(page); ok('leaving an unpinned preview closes it', s.hidden);

  [x, y] = await center(page, viSel);
  await page.mouse.click(x, y); await sleep(200);
  s = await cardState(page); ok('click opens and pins the card (Vietnamese mention)', !s.hidden && s.pinned && s.id === 'person:dinh-bo-linh', JSON.stringify(s));
  await page.mouse.move(5, 880, { steps: 4 }); await sleep(700);
  s = await cardState(page); ok('pinned card stays open after the pointer leaves', !s.hidden);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'web-desktop-card.png') });
  await page.keyboard.press('Escape'); await sleep(150);
  s = await cardState(page); ok('Escape closes the card', s.hidden);
  await page.mouse.click(x, y); await sleep(150); await page.click('#ecard .ec-x'); await sleep(150);
  s = await cardState(page); ok('close button closes the card', s.hidden);
  await page.mouse.click(x, y); await sleep(150); await page.mouse.click(700, 60); await sleep(150);
  s = await cardState(page); ok('clicking outside closes a pinned card', s.hidden);

  await page.mouse.click(x, y); await sleep(150);
  const tt = await page.locator('#ecard .ec-box.tt').textContent();
  ok('"In Đại Việt sử ký toàn thư" shows names, type and the occurrence count', /丁部領 · 部領 · 先皇帝/.test(tt) && /Đinh Bộ Lĩnh · Bộ Lĩnh · Tiên Hoàng/.test(tt) && /Person/.test(tt) && /15 times/.test(tt), tt.replace(/\s+/g, ' ').slice(0, 200));
  ok('no invented descriptive claims in the database section', !/founder|sáng lập/i.test(tt));
  const wk = await page.locator('#ecard .ec-box').first().textContent();
  ok('Wikipedia section is labelled and honest when no verified mapping exists', /Wikipedia \(tiếng Việt\)/.test(wk) && /No Wikipedia article linked/.test(wk) && /not been run/.test(wk), wk.replace(/\s+/g, ' '));

  const rels = await page.$$eval('#ecard .ec-rels li', (lis) => lis.map((li) => li.querySelector('.ec-pill').textContent + ' → ' + li.querySelector('.ec-tgt').textContent));
  ok('relations come from data (child_of, founded_polity, capital_at, killed-by)', rels.some((r) => /^Child of → Đinh Công Trứ/.test(r)) && rels.some((r) => /^Founded → Đại Cồ Việt/.test(r)) && rels.some((r) => /^Capital → Hoa Lư/.test(r)) && rels.some((r) => /^Killed by → Đỗ Thích/.test(r)), rels.join('; '));
  await page.click('#ecard .ec-tgt[data-ent-go="person:dinh-cong-tru"]'); await sleep(150);
  s = await cardState(page); ok("relation target opens that entity's card", s.id === 'person:dinh-cong-tru' && s.title === 'Đinh Công Trứ', JSON.stringify(s));
  const back = await page.locator('#ecard [data-ent-back]').count();
  const inv = await page.$$eval('#ecard .ec-rels li', (lis) => lis.map((li) => li.textContent));
  ok('inverse relation shown on the target (Parent of → Đinh Bộ Lĩnh)', inv.some((t) => /Parent of.*Đinh Bộ Lĩnh/.test(t)), inv.join('; '));
  await page.click('#ecard [data-ent-back]'); await sleep(150);
  s = await cardState(page); ok('back button returns to Đinh Bộ Lĩnh', back === 1 && s.id === 'person:dinh-bo-linh');

  await page.click('#ecard [data-ent-tab="occ"]'); await sleep(100);
  const occ = await page.$$eval('#ecard .ec-occ button', (bs) => bs.map((b) => ({ id: b.querySelector('.id').textContent, lg: b.querySelector('.lg').textContent, t: b.querySelector('b').textContent, i: b.dataset.entOcc })));
  ok('occurrence list: entry, language, surface, context; aliases count together', occ.length === 15 && new Set(occ.map((o) => o.t)).size >= 3 && occ.some((o) => o.lg === 'ZH') && occ.some((o) => o.lg === 'VI'), `${occ.length}: ` + [...new Set(occ.map((o) => o.t))].join(', '));
  const far = occ.filter((o) => o.id !== 'E01').slice(-1)[0];
  await page.click(`#ecard [data-ent-occ="${far.i}"]`);
  // wait for the scroll to settle (up to 3 s) instead of sampling at a fixed time
  await page.waitForFunction((i) => { const el = [...document.querySelectorAll(`.ent[data-m="${i}"]`)].find((x) => x.offsetParent); if (!el) return false; const r = el.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }, far.i, { timeout: 3000 }).catch(() => {});
  const nav = await page.evaluate((i) => { const els = [...document.querySelectorAll(`.ent[data-m="${i}"]`)].filter((x) => x.offsetParent); const r = els[0].getBoundingClientRect();
    return { flash: els.every((x) => x.classList.contains('eflash')), inView: r.top > 0 && r.bottom < innerHeight, entry: els[0].closest('.entry').id, closed: document.querySelector('#ecard').hidden }; }, far.i);
  ok('clicking an occurrence scrolls to it and highlights it', nav.flash && nav.inView && nav.entry === far.id && nav.closed, JSON.stringify(nav));

  await page.mouse.move(5, 880); await sleep(100);
  await page.evaluate(() => document.getElementById('E02').scrollIntoView({ block: 'center' })); await sleep(200);
  [x, y] = await center(page, '#E02 .zh .cl[data-g="2"]');
  await page.mouse.move(x, y); await sleep(150);
  let lit = await page.evaluate(() => ({ z: document.querySelectorAll('#E02 .zh .cl.lit').length, v: document.querySelectorAll('#E02 .vi[data-tl="vi"] .cl.lit').length }));
  ok('clause alignment: hovering a Chinese clause lights its Vietnamese counterpart', lit.z > 0 && lit.v > 0, JSON.stringify(lit));
  await page.mouse.move(5, 880); await sleep(100);
  await page.evaluate(() => document.getElementById('E04').scrollIntoView({ block: 'center' })); await sleep(200);
  await page.locator(`#E04 ${VI} .ent[data-ent="person:ngo-xuong-xi"]`).first().hover(); await sleep(150);
  lit = await page.evaluate(() => ({ z: document.querySelectorAll('#E04 .zh .cl.lit').length, v: document.querySelectorAll('#E04 .vi .cl.lit').length, eh: document.querySelectorAll('#E04 .ent.eh').length }));
  ok('hovering an entity also lights its clause pair', lit.z > 0 && lit.v > 0 && lit.eh > 0, JSON.stringify(lit));
  await page.mouse.move(5, 880); await sleep(500);

  const rv = await page.evaluate(() => document.querySelector('.ent.erv[data-ent="place:truong-yen"]')?.textContent ?? null);
  ok('review-required mention (Trường Yên / 長安) is marked as under review', !!rv, rv);
  await page.evaluate(() => window.__dvsktt.openEnt('place:truong-yen')); await sleep(150);
  ok('card for a review-required place shows the uncertainty', (await page.locator('#ecard .ec-flag').count()) === 1 && (await page.locator('#ecard .ec-note').count()) === 1);
  await page.evaluate(() => window.__dvsktt.openEnt('person:dinh-lien')); await sleep(150);
  const varNote = await page.locator('#ecard .ec-note').textContent().catch(() => '');
  ok('suspected textual error (Nam Việt Vương Liệt) is a review variant, not an alias', /Nam Việt Vương Liệt/.test(varNote) && /suspected textual error/.test(varNote) && !/Liệt/.test(await page.locator('#ecard .ec-aka').textContent()));
  await page.keyboard.press('Escape');

  await page.evaluate(() => document.getElementById('E01').scrollIntoView({ block: 'center' }));
  await page.focus(viSel); await page.keyboard.press('Enter'); await sleep(150);
  s = await cardState(page); ok('keyboard: Enter on a focused entity opens the card', !s.hidden && s.pinned);
  await page.keyboard.press('Escape'); await sleep(100);

  // character dictionary
  await page.mouse.click(...(await center(page, '#E01 .zh .hz[data-c="姓"]'))); await sleep(200);
  const pop = await page.evaluate(() => ({ hidden: document.querySelector('#pop').hidden, c: document.querySelector('#pop .bigc')?.textContent, hv: document.querySelector('#pop .hv')?.textContent }));
  ok('clicking a Chinese character opens the dictionary with its Hán-Việt reading', !pop.hidden && pop.c === '姓' && pop.hv === 'tính', JSON.stringify(pop));
  await page.keyboard.press('Escape'); await sleep(100);

  // footnote
  await page.click('#E01 .fr[data-n="1"]'); await sleep(400);
  ok('footnote reference jumps to and flashes the footnote', await page.evaluate(() => document.getElementById('E01-fn1').classList.contains('flash')));

  // search
  await page.fill('#q', 'sứ quân'); await sleep(600);
  const res = await page.$$eval('#results .res', (r) => r.length);
  ok('search finds Vietnamese text without diacritics sensitivity issues', res > 0, `${res} results`);
  await page.fill('#q', '部領'); await sleep(400);
  ok('search finds Chinese text', (await page.$$eval('#results .res', (r) => r.length)) > 0);
  await page.click('#results .res'); await sleep(800);
  await page.fill('#q', ''); await page.keyboard.press('Escape');

  // layout modes and settings
  await page.click('.mode-seg [data-mode="zh"]'); await sleep(100);
  ok('layout "中文" hides the translation column', await page.evaluate(() => getComputedStyle(document.querySelector('#E01 .vic')).display === 'none'));
  await page.click('.mode-seg [data-mode="both"]'); await sleep(100);
  await page.click('#bGear'); await sleep(200);
  ok('settings panel opens', await page.evaluate(() => document.querySelector('#settings').classList.contains('open')));
  await page.click('#settings [data-sw="ruby"]'); await sleep(100);
  ok('Hán-Việt readings switch shows ruby text', await page.evaluate(() => getComputedStyle(document.querySelector('#E01 .hz rt')).display !== 'none'));
  await page.click('#settings [data-sw="ruby"]');
  await page.keyboard.press('Escape'); await sleep(150);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('dvsktt.prefs.v1') || '{}').ruby === false);
  ok('preferences persist in this browser', persisted);

  // forum
  await page.click('#E10 .fbtn'); await sleep(200);
  ok('correction discussions open for a passage with seeded threads', await page.evaluate(() => document.querySelector('#forum').classList.contains('open') && document.querySelectorAll('#forumBody .trow').length > 0));
  await page.keyboard.press('Escape'); await sleep(150);

  // English
  await page.evaluate(() => window.__dvsktt.setLang('en')); await sleep(250);
  const en = await page.evaluate(() => ({ zh: document.querySelectorAll('.zh .ent').length, envis: [...document.querySelectorAll('.vi')].filter((x) => x.offsetParent).every((x) => x.lang === 'en'),
    enEnt: document.querySelectorAll('.vi[data-tl="en"] .ent').length, fns: [...document.querySelectorAll('.fns')].some((x) => x.offsetParent) }));
  ok('EN mode: English shown, Chinese entities stay interactive, footnotes hidden', en.zh > 0 && en.envis && en.enEnt === 0 && !en.fns, JSON.stringify(en));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'web-desktop-en.png') });
  await page.evaluate(() => window.__dvsktt.setLang('vi')); await sleep(200);
  ok('no JavaScript errors on desktop', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- phone
{
  const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'web-phone-top.png') });
  await page.evaluate(() => document.getElementById('E01').scrollIntoView({ block: 'center' })); await sleep(250);
  const [x, y] = await center(page, `#E01 ${VI} .ent[data-ent="person:dinh-bo-linh"]`);
  await page.touchscreen.tap(x, y); await sleep(300);
  const s = await cardState(page);
  const lit = await page.evaluate(() => document.querySelectorAll('#E01 .cl.lit').length);
  ok('phone: tap opens the card as a bottom sheet', !s.hidden && s.sheet && s.id === 'person:dinh-bo-linh', JSON.stringify(s));
  ok('phone: tapping an entity also selects its clause pair', lit > 0, `${lit} lit`);
  const box = await page.locator('#ecard').boundingBox();
  ok('phone: sheet is full width and anchored to the bottom', Math.abs(box.width - 390) < 2 && Math.abs(box.y + box.height - 844) < 2, JSON.stringify(box));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'web-phone-sheet.png') });
  await page.touchscreen.tap(195, 40); await sleep(200);
  ok('phone: tapping the scrim closes the sheet', (await cardState(page)).hidden);
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok('phone: no horizontal page scroll', !hscroll);
  ok('no JavaScript errors on phone', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} FAILED` : `\nALL ${results.length} PASSED`);
process.exit(failed ? 1 : 0);
