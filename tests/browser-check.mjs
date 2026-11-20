// End-to-end check in a real browser. Not part of CI (it needs Chrome and
// puppeteer-core); run it by hand after changing the viewer:
//
//   python3 -m http.server 8770 &
//   npm i --no-save puppeteer-core
//   CHROME=/path/to/chrome node tests/browser-check.mjs http://localhost:8770/index.html
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://localhost:8770/index.html';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
const problems = [];
page.on('pageerror', e => problems.push('page error: ' + e.message));
page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
let passed = 0;
const ok = (cond, what) => { if (cond) passed++; else problems.push('FAILED: ' + what); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const open = async (hash, w = 1440, h = 900) => { await page.setViewport({ width: w, height: h }); await page.goto(base + (hash ? '#' + hash : ''), { waitUntil: 'networkidle0' }); await page.evaluate(h => { if (location.hash !== (h ? '#' + h : '')) location.hash = h; }, hash); await wait(250); };
const text = sel => page.$eval(sel, el => el.textContent);
const click = async sel => { await page.click(sel); await wait(120); };
const depth = async n => { await page.keyboard.press(String(n)); await wait(120); };

// --- landing lists every work, and the demo line cycles
await open('');
ok((await page.$$('.works li a')).length === 4, 'landing lists four works');
const before = await text('.demo .crux'); await click('.demo .crux');
ok(await text('.demo .crux') !== before, 'demo crux cycles to the next reading');

// --- Dickinson: choose a reading, argue, propose, persist
await open('fr124'); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
await depth(3);
ok((await page.$$('.margin .note')).length === 2, 'two margin entries at depth 3');
const tops = await page.$$eval('.margin .note', ns => ns.map(n => n.getBoundingClientRect().top));
ok(tops[0] < tops[1], 'margin entries are in reading order and do not overlap');
await click('.rd .crux');
ok(await page.$eval('#panel', p => !p.hidden), 'clicking a crux opens the panel');
ok(await page.evaluate(() => document.activeElement.tagName === 'H2'), 'focus moves into the panel');
await page.evaluate(() => [...document.querySelectorAll('#panel input[type=radio]')][1].click()); await wait(150);
ok(await text('.rd .crux') === 'Lie', 'choosing a reading changes the text');
ok(await page.$eval('.bar select', s => s.value) === 'mine', 'choosing switches to "I would have it"');
await page.evaluate(() => [...document.querySelectorAll('#panel .btn')].find(b => b.textContent === 'Argue for this reading').click()); await wait(120);
await page.type('#panel form.f textarea', 'too short'); await click('#panel form.f button[type=submit]');
ok((await text('#panel form.f .err')).includes('reasoning'), 'a bare vote is refused');
await page.type('#panel form.f textarea', ' — it is what her revised fair copy reads, in her own hand.');
await page.type('#panel form.f input[name=who]', 'Test Reader'); await click('#panel form.f button[type=submit]');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('variorum.v3.fr124')).voices.length === 1), 'a reasoned voice is saved');
ok((await page.$$('#panel .voice.contributed')).length === 1, 'the saved voice shows in the panel');
await page.keyboard.press('Escape'); await wait(120);
ok(await page.$eval('#panel', p => p.hidden), 'Escape closes the panel');
ok(await page.evaluate(() => document.activeElement.classList.contains('crux')), 'focus returns to the crux that opened it');
await click('[data-fk="propose"]');
await page.select('#panel select[name=line]', 'stanza1|3');
await page.type('#panel input[name=phrase]', 'meek'); await page.type('#panel input[name=alt]', 'weak');
await page.type('#panel textarea[name=why]', 'Only to test that a proposed crux is anchored and drawn.'); await click('#panel form.f button[type=submit]');
ok((await page.$$('.rd .crux.local')).length === 1, 'a proposed crux is drawn in the text');
await page.reload({ waitUntil: 'networkidle0' }); await wait(200);
ok(await text('.rd .crux') === 'Lie' && (await page.$$('.rd .crux.local')).length === 1, 'additions survive a reload');
await page.select('.bar select', 'w:fascicle-6'); await wait(150);
ok(await text('.rd .crux') === 'Sleep' && (await text('.rd.stanza.is-crux')).startsWith('Light laughs'), 'reading as Fascicle 6 gives its readings');
await depth(4);
ok((await page.$$('#voices .crux-block')).length === 3, 'depth 4 lays out every crux, including the reader\'s');
await click('[data-fk="about"]'); await click('[data-fk="exp"]');
ok(JSON.parse(await page.$eval('.export', t => t.value)).voices.length === 1, 'export contains the reader\'s voice');
await page.evaluate(() => localStorage.clear());

// --- every work at every depth: no errors, no sideways scrolling, margin in order
for (const id of ['fr124', 'sonnet-116', 'rilke-elegie-1', 'sappho-31']) {
    for (const w of [390, 820, 1280, 1700]) {
        await open(id, w, 900);
        for (const d of [1, 2, 3, 4]) {
            await depth(d);
            const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, head: !!document.querySelector('.head h1'),
                notes: [...document.querySelectorAll('.texts > .margin .note')].filter(n => n.offsetParent).map(n => [n.getBoundingClientRect().top, n.getBoundingClientRect().bottom]) }));
            ok(r.head, `${id} renders at depth ${d}, ${w}px`);
            ok(r.over <= 1, `${id} depth ${d} at ${w}px does not scroll sideways (over by ${r.over}px)`);
            ok(r.notes.every((n, i) => !i || n[0] >= r.notes[i - 1][1]), `${id} depth ${d} at ${w}px: margin entries do not overlap`);
        }
    }
}
// --- translation work: witness readings and parallel lemma
await open('rilke-elegie-1', 1700); await depth(3);
await page.select('.bar select', 'w:snow-2000'); await wait(150);
ok(await text('.rd .crux') === 'orders', 'reading Rilke as Snow gives "orders"');
ok((await page.$$('.rd .crux.silent')).length === 2, 'cruxes where Snow is not recorded are marked');
ok((await page.$$('.src .lemma')).length === 5, 'the German lemmas are marked in the parallel source');
await page.evaluate(() => localStorage.clear());

// --- a missing work fails with a message, not a blank page
page.removeAllListeners('console');   // the 404 below is the point of the test
await open('no-such-work');
ok((await text('#main')).includes('could not be opened'), 'a missing work explains itself');

console.log(`${passed} checks passed`);
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
await browser.close();
