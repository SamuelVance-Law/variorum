/*
 * Variorum — viewer.
 *
 * One page. With no work named it lists the works in works/index.json;
 * with index.html#<id> (or the older ?work=<id>) it opens that work.
 *
 * The page is a document, not a canvas. Four depths show progressively
 * more of the apparatus:
 *   1 Source    the primary witness alone
 *   2 Reading   the reading text, cruxes underlined
 *   3 Variants  + the margin apparatus and the witnesses
 *   4 Voices    + every argument, laid out in full
 * A side panel gives one crux (or one witness) at full depth from anywhere.
 *
 * All decisions about the data live in core.js and validate.js; this file
 * only draws and listens. Text reaches the DOM through textContent only.
 */
(function () {
    'use strict';
    var V = window.VariorumValidate, C = window.VariorumCore;
    var DEPTHS = ['Source', 'Reading', 'Variants', 'Voices'];
    var REPO = 'https://github.com/SamuelVance-Law/variorum';

    var S = null;          // state of the open work
    var main = document.getElementById('main');
    var bar = document.getElementById('bar');
    var panel = document.getElementById('panel');
    var live = document.getElementById('live');

    // ---------- tiny DOM helper ----------
    function h(tag, attrs) {
        var el = document.createElement(tag), i, k;
        for (k in (attrs || {})) {
            var v = attrs[k];
            if (v == null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
            else if (k === 'value') el.value = v;
            else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
            else el.setAttribute(k, v === true ? '' : v);
        }
        for (i = 2; i < arguments.length; i++) add(el, arguments[i]);
        return el;
    }
    function add(el, c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
        else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }
    function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
    // A span that behaves as a button but, unlike <button>, wraps across lines.
    function pressable(tag, attrs, fn) {
        attrs.role = 'button'; attrs.tabindex = '0';
        attrs.onclick = fn;
        attrs.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } };
        return h.apply(null, [tag, attrs].concat([].slice.call(arguments, 3)));
    }
    function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
    function store(key, val) {
        try {
            if (val === undefined) { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e) { return null; }
    }
    function uid() { return 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
    function today() { return new Date().toISOString().slice(0, 10); }

    // ---------- routing ----------
    function currentId() {
        var q = new URLSearchParams(location.search).get('work');
        var hash = decodeURIComponent(location.hash.replace(/^#/, ''));
        var id = hash || q || '';
        return /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : '';
    }
    function route() {
        closePanel(true);
        var id = currentId();
        window.scrollTo(0, 0);
        if (id) openWork(id); else landing();
    }
    window.addEventListener('hashchange', route);

    function fetchJson(url) {
        return fetch(url, { cache: 'no-cache' }).then(function (r) {
            if (!r.ok) throw new Error(url + ' could not be loaded (HTTP ' + r.status + ').');
            return r.json().catch(function (e) { throw new Error(url + ' is not valid JSON: ' + e.message); });
        });
    }
    function fail(title, lines, hint) {
        S = null; clear(bar); bar.appendChild(mark());
        clear(main);
        main.appendChild(h('div', { class: 'fail' },
            h('h1', null, title),
            h('ul', null, lines.map(function (l) { return h('li', null, '· ' + l); })),
            hint && h('p', null, hint),
            h('p', null, h('a', { href: '#' }, 'Back to the list of works'))));
    }
    function mark() { return h('a', { class: 'mark', href: '#', onclick: function (e) { e.preventDefault(); history.pushState(null, '', location.pathname); route(); } }, 'Variorum'); }

    // ====================================================================
    // LANDING
    // ====================================================================
    function landing() {
        S = null; document.title = 'Variorum';
        clear(bar); bar.appendChild(mark());
        bar.appendChild(h('a', { href: REPO }, 'Repository'));
        clear(main);
        var root = h('div', { class: 'landing' },
            h('h1', null, 'Variorum'),
            h('p', { class: 'say' }, 'Editions that keep every contested reading in view, say which documents carry it, and record who argues for it and why.'));
        main.appendChild(root);
        fetchJson('works/index.json').then(function (m) {
            return Promise.all(m.works.map(function (entry) {
                return fetchJson('works/' + entry.id + '.json').then(function (w) { return { entry: entry, work: w }; },
                                                                       function (e) { return { entry: entry, error: e }; });
            }));
        }).then(function (items) {
            var good = items.filter(function (it) { return it.work && !V.validate(it.work).errors.length; });
            var demo = good.length && demoLine(good[0].work);
            if (demo) root.appendChild(demo);
            root.appendChild(h('ul', { class: 'works' }, items.map(function (it) {
                if (!it.work) return h('li', null, h('p', { class: 'meta' }, it.entry.id + ': ' + it.error.message));
                var w = it.work, st = C.stats(w);
                return h('li', null, h('a', { href: '#' + w.id },
                    h('h2', null, w.work.title),
                    h('div', { class: 'by' }, [w.work.author, w.work.date].filter(Boolean).join(', ')),
                    h('p', null, it.entry.blurb),
                    h('div', { class: 'facts' },
                        h('div', null, it.entry.kind || w.work.kind || ''),
                        h('div', null, plural(st.cruxes, 'crux', 'cruxes') + ', ' + plural(w.witnesses.length, 'witness', 'witnesses')),
                        h('div', null, w.edition && w.edition.status === 'reviewed' ? 'Reviewed' : 'Draft apparatus'))));
            })));
            root.appendChild(h('div', { class: 'more' },
                h('p', null, 'A variorum is an edition that preserves the variants instead of choosing among them. The form is as old as Bentley’s Horace and has always depended on a quiet collective: editors weighing manuscripts, earlier editions, letters and arguments. Here that collective is on the page.'),
                h('p', null, 'Open a work and read it at four depths, as any one witness has it, or as you would have it. To add a work, copy ', h('a', { href: 'works/_template.json' }, 'the template'), ' and read ', h('a', { href: 'schema.md' }, 'the schema'), '.')));
        }).catch(function (e) { root.appendChild(h('p', { class: 'meta' }, e.message)); });
    }
    // The landing page opens on the thing itself: one real line with a live crux.
    function demoLine(work) {
        var found = null;
        work.reading.stanzas.forEach(function (s) {
            (s.lines || []).forEach(function (line) {
                var p = C.parseLine(line);
                if (!found && p.segs.some(function (g) { return g.t === 'slot'; })) found = p;
            });
        });
        if (!found) return null;
        var pick = {}, box = h('div', { class: 'demo' });
        function draw() {
            clear(box);
            var cruxes = [];
            box.appendChild(h('div', { class: 'verse' }, found.segs.map(function (g) {
                if (g.t === 'text') return g.s;
                var crux = C.findCrux(work, g.id), i = pick[g.id] || 0; cruxes.push(crux);
                return pressable('span', { class: 'crux' + (i ? ' altered' : ''), 'aria-label': crux.positions[i].label + '. Contested: press to see the next reading.' },
                    function () { pick[g.id] = (i + 1) % crux.positions.length; draw(); box.querySelector('.crux').focus(); }, crux.positions[i].label);
            })));
            cruxes.forEach(function (crux) { box.appendChild(h('div', { class: 'note' }, noteBody(work, crux, crux.positions[pick[crux.id] || 0], 3))); });
            box.appendChild(h('div', { class: 'cap' }, work.work.author + ', ' + work.work.title + '. Press the underlined word. Letters name the witnesses that carry each reading; a question mark means nobody has checked it against the document yet.'));
        }
        draw();
        return box;
    }

    // ====================================================================
    // A WORK
    // ====================================================================
    function openWork(id) {
        clear(main); main.appendChild(h('p', { class: 'meta' }, 'Loading…'));
        fetchJson('works/' + id + '.json').then(function (data) {
            var res = V.validate(data);
            if (res.errors.length) return fail('This work file has errors and was not opened', res.errors, 'Fix works/' + id + '.json and reload. The same checks run in CI: node tools/validate.mjs');
            var saved = store('variorum.v3.' + id) || {};
            S = {
                id: id, base: data, work: data, orphans: [],
                depth: saved.depth || 2, mode: saved.mode || 'editor',
                parallel: saved.parallel != null ? saved.parallel : !!(data.source && data.source.lang !== data.reading.lang),
                local: { choices: saved.choices || {}, voices: saved.voices || [], positions: saved.positions || [], cruxes: saved.cruxes || [] },
                name: (store('variorum.identity') || {}).name || '',
                panel: null, form: null, missing: []
            };
            if (!data.source && S.depth === 1) S.depth = 2;
            if (S.mode.indexOf('w:') === 0 && !C.findWitness(data, S.mode.slice(2))) S.mode = 'editor';
            document.title = data.work.title + ' · Variorum';
            draw();
        }).catch(function (e) {
            fail('This work could not be opened', [e.message], location.protocol === 'file:' ? 'Browsers do not let a page opened from a file load its data. Serve the folder (python3 -m http.server) or use the deployed site.' : null);
        });
    }
    function save() {
        store('variorum.v3.' + S.id, { depth: S.depth, mode: S.mode, parallel: S.parallel, choices: S.local.choices, voices: S.local.voices, positions: S.local.positions, cruxes: S.local.cruxes });
        store('variorum.identity', { name: S.name });
    }
    function localCount() { return S.local.voices.length + S.local.positions.length + S.local.cruxes.length + Object.keys(S.local.choices).length; }

    // Redraw everything, keeping keyboard focus where it was.
    function draw() {
        var fk = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-fk');
        var merged = C.mergeOverlay(S.base, S.local);
        S.work = merged.work; S.orphans = merged.orphans; S.missing = [];
        drawBar(); drawMain(); drawPanel();
        if (fk) { var el = document.querySelector('[data-fk="' + fk + '"]'); if (el) el.focus({ preventScroll: true }); }
        layout();
    }

    function drawBar() {
        clear(bar);
        bar.appendChild(mark());
        bar.appendChild(h('div', { class: 'depth', role: 'group', 'aria-label': 'How much of the apparatus to show' }, DEPTHS.map(function (name, i) {
            if (i === 0 && !S.work.source) return null;
            return h('button', { type: 'button', 'aria-pressed': String(S.depth === i + 1), 'data-fk': 'depth' + i, onclick: function () { setDepth(i + 1); } }, name, h('kbd', { 'aria-hidden': 'true' }, i + 1));
        })));
        var readable = C.readableWitnesses(S.work);
        bar.appendChild(h('label', null, 'Read as',
            h('select', { 'data-fk': 'mode', onchange: function (e) { setMode(e.target.value); } },
                h('option', { value: 'editor', selected: S.mode === 'editor' }, 'the editor has it'),
                h('option', { value: 'mine', selected: S.mode === 'mine' }, 'I would have it'),
                readable.length ? h('optgroup', { label: 'A witness has it' }, readable.map(function (r) {
                    return h('option', { value: 'w:' + r.witness.id, selected: S.mode === 'w:' + r.witness.id }, r.witness.siglum + '  ' + shortName(r.witness));
                })) : null)));
        if (S.work.source && S.depth > 1) bar.appendChild(h('label', null,
            h('input', { type: 'checkbox', checked: S.parallel, 'data-fk': 'par', onchange: function (e) { S.parallel = e.target.checked; save(); draw(); } }), 'Source alongside'));
        bar.appendChild(h('button', { type: 'button', class: 'btn plain', 'data-fk': 'about', onclick: function () { openPanel({ type: 'about' }, 'about'); } }, 'About this edition'));
    }
    function shortName(w) { return (w.creator ? w.creator.replace(/,? ?(trans|ed)\.?$/, '') : w.title) + (w.date ? ', ' + w.date : ''); }
    function setDepth(n) {
        if (n === 1 && !S.work.source) return;
        S.depth = n; save(); draw(); say(DEPTHS[n - 1] + ' view.');
    }
    function setMode(m) {
        S.mode = m; save(); draw();
        say(m === 'editor' ? 'Reading the editor’s text.' : m === 'mine' ? 'Reading your own text.' : 'Reading as ' + shortName(C.findWitness(S.work, m.slice(2))) + '.');
    }
    document.addEventListener('keydown', function (e) {
        if (!S) return;
        if (e.key === 'Escape' && S.panel) { e.preventDefault(); closePanel(); return; }
        if (e.target.matches && e.target.matches('input, textarea, select')) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key >= '1' && e.key <= '4') setDepth(+e.key);
    });

    // ---------- main column ----------
    function drawMain() {
        var w = S.work, st = C.stats(w);
        clear(main);
        main.className = 'depth-' + S.depth;
        main.appendChild(h('header', { class: 'head' },
            h('h1', { lang: w.work.language && S.depth === 1 ? null : null }, w.work.title),
            h('div', { class: 'byline' }, [w.work.author, w.work.date].filter(Boolean).join(', ')),
            h('p', { class: 'status' }, statusLine(w, st),
                h('button', { type: 'button', class: 'btn', 'data-fk': 'status', onclick: function () { openPanel({ type: 'about' }, 'status'); } }, 'What this means'))));
        if (S.depth === 1) { main.appendChild(sourceOnly()); return; }
        main.appendChild(texts());
        if (S.depth >= 3) main.appendChild(witnessSection());
        if (S.depth >= 4) main.appendChild(voicesSection());
    }
    function statusLine(w, st) {
        var bits = [];
        bits.push(w.edition && w.edition.status === 'reviewed' ? 'Reviewed apparatus.' : 'Draft apparatus.');
        if (st.unverifiedAttestations) bits.push(st.unverifiedAttestations + ' of ' + plural(st.attestations, 'attribution') + ' to a witness not yet checked against the source (marked ?).');
        if (st.voices.illustrative) bits.push(plural(st.voices.illustrative, 'voice') + ' invented for illustration.');
        if (localCount()) bits.push('Your own additions are kept in this browser only.');
        return bits.join(' ') + ' ';
    }

    // Depth 1: the primary witness and nothing else.
    function sourceOnly() {
        var src = S.work.source, wit = C.findWitness(S.work, src.witnessId);
        var box = h('div', { class: 'source-only' + (wit.image ? '' : ' no-image') });
        if (wit.image) box.appendChild(h('figure', null,
            h('img', { src: wit.image.src, alt: wit.image.alt || '', onload: layoutMargin }),
            h('figcaption', null, wit.image.credit || '')));
        var col = h('div', { class: 'src', lang: src.lang || null }, h('div', { class: 'text-label' }, src.label || wit.title));
        src.stanzas.forEach(function (s) { col.appendChild(sourceStanza(s)); });
        col.appendChild(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn', 'data-fk': 'srcwit', onclick: function () { openPanel({ type: 'witness', id: wit.id }, 'srcwit'); } }, 'About this document')));
        box.appendChild(col);
        return box;
    }
    function sourceStanza(s) {
        return h('div', { class: 'src stanza', lang: S.work.source.lang || null }, s.lines.map(function (line) {
            var p = C.parseLine(line);
            return h('div', { class: 'line' + (p.indent ? ' indent' : '') }, p.segs.map(function (g, i) {
                if (g.t === 'text') return g.s;
                var crux = C.findCrux(S.work, g.id), key = 'lem-' + s.id + '-' + g.id + '-' + i;
                return pressable('span', { class: 'lemma', 'data-crux': g.id, 'data-fk': key, 'aria-label': g.s + '. Contested: open the apparatus.',
                    onmouseenter: function () { hot(g.id, true); }, onmouseleave: function () { hot(g.id, false); } },
                    function () { openPanel({ type: 'crux', id: crux.id }, key); }, g.s);
            }));
        }));
    }

    // Depth 2+: the reading text, optionally with the source alongside.
    function texts() {
        var w = S.work, src = w.source, aligned = src && src.stanzas.length === w.reading.stanzas.length;
        var parallel = S.parallel && src;
        var box = h('div', { class: 'texts' + (parallel ? ' parallel' : '') });
        var margin = h('aside', { class: 'margin', 'aria-label': 'Apparatus' });
        box.appendChild(h('div', { class: 'row' },
            h('div', { class: 'src text-label' }, src ? (src.label || '') : ''),
            h('div', { class: 'rd text-label' }, w.reading.label || 'Reading text')));
        if (parallel && !aligned) box.appendChild(h('div', { class: 'row' }, h('div', { class: 'src' }, src.stanzas.map(sourceStanza)), h('div')));
        var lineNo = 0;
        w.reading.stanzas.forEach(function (s, si) {
            var ids = [], el;
            if (s.crux) {
                var crux = C.findCrux(w, s.crux), r = C.resolve(crux, S.mode, S.local.choices), key = 'st-' + crux.id;
                ids.push(crux.id);
                el = h('div', { class: 'rd stanza is-crux', 'data-crux': crux.id, 'data-anchor': crux.id });
                C.readingText(r.position).split('\n').forEach(function (t) { lineNo++; el.appendChild(lineEl(lineNo, /^\s/.test(t), [t.trim()])); });
                var idx = crux.positions.indexOf(r.position);
                var step = function (d) { return function () { choose(crux, crux.positions[(idx + d + crux.positions.length) % crux.positions.length]); }; };
                el.appendChild(h('div', { class: 'stanza-ctl' },
                    S.depth >= 3 ? [h('button', { type: 'button', class: 'btn plain', 'aria-label': 'Previous version', 'data-fk': key + 'p', onclick: step(-1) }, '←'),
                        h('span', { class: 'which' }, r.position.label), h('span', null, (idx + 1) + ' of ' + crux.positions.length),
                        h('button', { type: 'button', class: 'btn plain', 'aria-label': 'Next version', 'data-fk': key + 'n', onclick: step(1) }, '→')] : null,
                    h('button', { type: 'button', class: 'btn', 'data-fk': key, onclick: function () { openPanel({ type: 'crux', id: crux.id }, key); } },
                        S.depth >= 3 ? 'Compare versions' : plural(crux.positions.length, 'version') + ' of this stanza')));
            } else {
                el = h('div', { class: 'rd stanza', lang: w.reading.lang || null });
                s.lines.forEach(function (line, li) {
                    lineNo++;
                    var p = C.parseLine(line);
                    var anchors = w.cruxes.filter(function (c) { return c.anchor && c.anchor.stanzaId === s.id && c.anchor.line === li; })
                        .map(function (c) { return { id: c.id, phrase: c.anchor.phrase }; });
                    var a = C.applyAnchors(p.segs, anchors); S.missing = S.missing.concat(a.missing);
                    var node = lineEl(lineNo, p.indent, a.segs.map(function (g, gi) {
                        if (g.t === 'text') return g.s;
                        if (ids.indexOf(g.id) === -1) ids.push(g.id);
                        return cruxSpan(C.findCrux(w, g.id), g, s.id + '-' + li + '-' + gi);
                    }));
                    node.setAttribute('data-st', s.id); node.setAttribute('data-li', li);
                    el.appendChild(node);
                });
            }
            var list = h('div', { class: 'app-list' });
            ids.forEach(function (id) { margin.appendChild(noteButton(id, 'm')); list.appendChild(noteButton(id, 'l')); });
            box.appendChild(h('div', { class: 'row' }, parallel && aligned ? sourceStanza(src.stanzas[si]) : h('div', { class: 'src' }), el, ids.length ? list : null));
        });
        if (S.depth >= 3) box.appendChild(h('div', { class: 'row' }, h('div', { class: 'src' }), h('div', { class: 'acts rd' },
            h('button', { type: 'button', class: 'btn', 'data-fk': 'propose', onclick: function () { openPanel({ type: 'propose' }, 'propose'); } }, 'Propose a crux'))));
        box.appendChild(margin);
        return box;
    }
    function lineEl(n, indent, kids) {
        return h('div', { class: 'line' + (indent ? ' indent' : '') }, (n === 1 || n % 5 === 0) ? h('span', { class: 'ln', 'aria-hidden': 'true' }, n) : null, kids);
    }
    function cruxSpan(crux, seg, where) {
        var key = 'cx-' + where, text, cls = 'crux';
        if (seg.t === 'lemma') { text = seg.s; cls = 'lemma'; }
        else {
            var r = C.resolve(crux, S.mode, S.local.choices);
            text = r.position.label;
            if (r.position !== C.foregrounded(crux)) cls += ' altered';
            if (r.fallback && S.mode.indexOf('w:') === 0) cls += ' silent';
            if (crux.local) cls += ' local';
        }
        return pressable('span', { class: cls, 'data-crux': crux.id, 'data-anchor': crux.id, 'data-fk': key,
            'aria-label': text + '. Contested, ' + plural(crux.positions.length, 'reading') + '. Open the apparatus.',
            title: cls.indexOf('silent') > -1 ? 'This witness is not recorded here; the editor’s reading is shown.' : null,
            onmouseenter: function () { hot(crux.id, true); }, onmouseleave: function () { hot(crux.id, false); } },
            function () { openPanel({ type: 'crux', id: crux.id }, key); }, text);
    }
    function hot(id, on) {
        [].forEach.call(document.querySelectorAll('[data-crux="' + id + '"]'), function (el) { el.classList.toggle('hot', on); });
    }

    // ---------- the apparatus entry:  where  lemma ] reading SIG · reading SIG ----------
    function sigla(work, p) {
        if (p.local) return [h('span', { class: 'sig' }, 'you')];
        if (p.conjecture) return [h('span', { class: 'sig' }, 'conj.')];
        return (p.attestations || []).map(function (a) {
            var wt = C.findWitness(work, a.witnessId);
            return h('span', { class: 'sig', title: wt.title + (a.verified === true ? '' : ' (not yet checked against the source)') }, wt.siglum, a.verified === true ? null : h('sup', null, '?'));
        });
    }
    function noteBody(work, crux, shown, depth) {
        var out = [], rest = crux.positions.slice();
        if (crux.lemma) out.push(h('span', { class: 'lem', lang: (work.source && work.source.lang) || null }, crux.lemma));
        else { rest.splice(rest.indexOf(shown), 1); out.push(rdg(shown, true)); }
        out.push(h('span', { class: 'bracket', 'aria-hidden': 'true' }, ']'));
        rest.forEach(function (p, i) { if (i) out.push(h('span', { class: 'sep', 'aria-hidden': 'true' }, '·')); out.push(rdg(p, p === shown)); });
        function rdg(p, isShown) {
            var n = (p.voices || []).length;
            return h('span', { class: 'rdg' + (isShown ? ' shown' : '') }, p.label, sigla(work, p),
                depth >= 4 && n ? h('span', { class: 'count' }, plural(n, 'voice')) : null);
        }
        return out;
    }
    function noteButton(id, where) {
        var crux = C.findCrux(S.work, id), key = 'note-' + where + '-' + id;
        return h('button', { type: 'button', class: 'note', 'data-for': id, 'data-crux': id, 'data-fk': key,
            onmouseenter: function () { hot(id, true); }, onmouseleave: function () { hot(id, false); },
            onclick: function () { openPanel({ type: 'crux', id: id }, key); } },
            h('span', { class: 'where' }, crux.label + (crux.local ? ' · proposed by you' : '')),
            noteBody(S.work, crux, C.resolve(crux, S.mode, S.local.choices).position, S.depth));
    }
    // Sidenotes: each entry sits level with its crux, pushed down only as far
    // as needed to clear the entry above.
    function layoutMargin() {
        var m = document.querySelector('.texts > .margin');
        if (!m || getComputedStyle(m).display === 'none') return;
        var top0 = m.getBoundingClientRect().top, y = 0;
        [].forEach.call(m.querySelectorAll('.note'), function (n) {
            var a = document.querySelector('.rd[data-anchor="' + n.getAttribute('data-for') + '"], .rd [data-anchor="' + n.getAttribute('data-for') + '"]');
            if (!a) return;
            var t = Math.max(a.getBoundingClientRect().top - top0 - 21, y);
            n.style.top = t + 'px'; y = t + n.offsetHeight + 12;
        });
    }
    // A parallel source keeps level with the reading line by line where the two
    // have the same number of lines; a wrapped line then pushes its partner down.
    function alignLines() {
        [].forEach.call(document.querySelectorAll('.texts.parallel .row'), function (row) {
            var a = row.querySelector('.src.stanza'), b = row.querySelector('.rd.stanza');
            if (!a || !b) return;
            var la = a.querySelectorAll('.line'), lb = b.querySelectorAll('.line'), i;
            for (i = 0; i < la.length; i++) la[i].style.minHeight = '';
            for (i = 0; i < lb.length; i++) lb[i].style.minHeight = '';
            if (la.length !== lb.length || a.getBoundingClientRect().left === b.getBoundingClientRect().left) return;
            for (i = 0; i < la.length; i++) { var m = Math.max(la[i].offsetHeight, lb[i].offsetHeight); la[i].style.minHeight = lb[i].style.minHeight = m + 'px'; }
        });
    }
    function layout() { alignLines(); layoutMargin(); }
    window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

    // ---------- witnesses (depth 3+) ----------
    function witnessSection() {
        var w = S.work;
        return h('section', { class: 'below', id: 'witnesses' },
            h('h2', null, 'Witnesses'),
            h('p', { class: 'lede' }, 'The documents this apparatus draws on. The letter beside each is its siglum, used wherever a reading is attributed to it.'),
            w.witnesses.map(function (wt) { return h('div', { class: 'wit', id: 'w-' + wt.id }, h('span', { class: 'sig' }, wt.siglum), h('div', null, witnessBody(wt, 'h3'))); }));
    }
    function witnessBody(wt, heading) {
        var w = S.work, out = [];
        out.push(h(heading, { tabindex: heading === 'h2' ? '-1' : null }, wt.title));
        out.push(h('div', { class: 'meta' }, [wt.creator, wt.date, wt.kind].filter(Boolean).join(' · ')));
        if (wt.summary) out.push(h('p', null, wt.summary));
        if (wt.quote) out.push(h('blockquote', { class: 'quote' }, wt.quote));
        if (wt.context) out.push(h('p', null, wt.context));
        out.push(h('div', { class: 'meta' }, wt.citation ? 'Cited as: ' + wt.citation : 'No citation recorded yet.'));
        var atts = C.attestationsOf(w, wt.id);
        if (atts.length) out.push(h('div', { class: 'meta' }, 'Reads: ', atts.map(function (a, i) {
            return [i ? '; ' : '', h('button', { type: 'button', class: 'btn', 'data-fk': 'wa-' + heading + wt.id + i, onclick: function () { openPanel({ type: 'crux', id: a.crux.id }); } },
                '“' + a.position.label + '”'), ' (' + a.crux.label + ')', a.attestation.verified === true ? '' : h('span', { class: 'q', title: 'Not yet checked against the source' }, ' ?')];
        })));
        (w.connections || []).forEach(function (c) {
            if (c.from !== wt.id && c.to !== wt.id) return;
            var f = C.findWitness(w, c.from), t = C.findWitness(w, c.to);
            out.push(h('div', { class: 'meta' }, h('span', { class: 'sig' }, f.siglum), ' ' + f.title + ' · ' + (c.relation || 'linked to') + ' · ', h('span', { class: 'sig' }, t.siglum), ' ' + t.title, c.note ? '. ' + c.note : ''));
        });
        return out;
    }

    // ---------- voices (depth 4) and the crux body shared with the panel ----------
    function voicesSection() {
        return h('section', { class: 'below', id: 'voices' },
            h('h2', null, 'Voices'),
            h('p', { class: 'lede' }, 'Every reading at every crux, with the arguments made for it. A voice always gives its reasons; there are no bare votes.'),
            S.work.cruxes.map(function (c) { return cruxBody(c, false); }));
    }
    function cruxBody(crux, inPanel) {
        var w = S.work, shown = C.resolve(crux, S.mode, S.local.choices).position, k = (inPanel ? 'p-' : 's-') + crux.id;
        var box = h('div', { class: 'crux-block' });
        box.appendChild(h('header', null,
            crux.lemma || crux.local ? h('div', { class: 'where' }, crux.lemma ? crux.label : '', crux.local ? ' proposed by you, kept in this browser only' : '') : null,
            h(inPanel ? 'h2' : 'h3', { tabindex: inPanel ? '-1' : null }, crux.lemma ? h('i', { lang: (w.source && w.source.lang) || null }, crux.lemma) : crux.label)));
        if (crux.note) box.appendChild(h('p', null, crux.note));
        crux.positions.forEach(function (p) {
            var pk = k + '-' + p.id, el = h('div', { class: 'pos' + (p === shown ? ' shown' : '') });
            var text = h('span', { class: 'rtext', lang: w.reading.lang || null }, C.readingText(p));
            el.appendChild(inPanel
                ? h('label', { class: 'choose' }, h('input', { type: 'radio', name: 'choose-' + crux.id, checked: p === shown, 'data-fk': pk + 'r', 'aria-label': 'Read with: ' + p.label, onchange: function () { choose(crux, p); } }), text)
                : h('div', null, text));
            var at = h('div', { class: 'attest' });
            if (p.local) add(at, 'Proposed by you. Kept in this browser only.');
            else if (p.conjecture) add(at, 'Conjecture: no witness is recorded as reading this.');
            else if (!(p.attestations || []).length) add(at, h('span', { class: 'tag warn' }, 'no source recorded'));
            else {
                add(at, 'Attested by');
                p.attestations.forEach(function (a, i) {
                    var wt = C.findWitness(w, a.witnessId);
                    add(at, h('button', { type: 'button', class: 'sig', 'data-fk': pk + 'w' + i, title: wt.title, onclick: function () { openPanel({ type: 'witness', id: wt.id, back: inPanel ? { type: 'crux', id: crux.id } : null }, pk + 'w' + i); } }, wt.siglum));
                    add(at, h('span', null, shortName(wt) + (a.locus ? ', ' + a.locus : '')));
                    add(at, a.verified === true ? h('span', { class: 'tag', title: a.note || 'Checked against the document.' }, 'checked')
                        : h('span', { class: 'tag warn', title: 'Nobody has yet checked this reading against the document itself.' }, 'unverified'));
                    if (a.note) add(at, h('span', { class: 'att-note' }, a.note));
                });
            }
            el.appendChild(at);
            if (p.note) el.appendChild(h('p', { class: 'ed-note' }, h('b', null, 'Editor’s note'), p.note));
            (p.voices || []).forEach(function (v) { el.appendChild(voiceEl(crux, p, v)); });
            if (inPanel) {
                if (S.form && S.form.type === 'voice' && S.form.cruxId === crux.id && S.form.positionId === p.id) el.appendChild(voiceForm(crux, p));
                else el.appendChild(h('div', { class: 'acts' },
                    h('button', { type: 'button', class: 'btn', 'data-fk': pk + 'v', onclick: function () { S.form = { type: 'voice', cruxId: crux.id, positionId: p.id }; drawPanel(); focusIn('form.f textarea'); } }, 'Argue for this reading'),
                    p.local ? h('button', { type: 'button', class: 'btn', 'data-fk': pk + 'x', onclick: function () { removeLocal('positions', p.id); } }, 'Withdraw this reading') : null));
            }
            box.appendChild(el);
        });
        if (inPanel) {
            if (S.form && S.form.type === 'position' && S.form.cruxId === crux.id) box.appendChild(positionForm(crux));
            else box.appendChild(h('div', { class: 'acts' },
                h('button', { type: 'button', class: 'btn', 'data-fk': k + 'add', onclick: function () { S.form = { type: 'position', cruxId: crux.id }; drawPanel(); focusIn('form.f textarea, form.f input'); } }, 'Propose another reading'),
                crux.local ? h('button', { type: 'button', class: 'btn', 'data-fk': k + 'del', onclick: function () { removeLocal('cruxes', crux.id); closePanel(); } }, 'Withdraw this crux') : null));
        } else box.appendChild(h('div', { class: 'acts' },
            h('button', { type: 'button', class: 'btn', 'data-fk': k + 'open', onclick: function () { openPanel({ type: 'crux', id: crux.id }, k + 'open'); } }, 'Choose a reading or add your voice')));
        return box;
    }
    var KIND = { illustrative: ['illustrative', 'Invented to show how the form works. Not a real person.'], attested: ['published', 'A position taken in print, cited below.'], contributed: ['reader', 'Contributed through this site.'] };
    function voiceEl(crux, p, v) {
        var kind = KIND[v.kind] || [v.kind, ''];
        return h('div', { class: 'voice ' + v.kind },
            h('div', { class: 'who' }, v.name,
                h('span', { class: 'tag', title: kind[1] }, v.local ? 'you, this browser only' : kind[0]),
                v.date ? h('span', { class: 'date' }, v.date) : null,
                v.local && v.id ? h('button', { type: 'button', class: 'btn', 'data-fk': 'wd-' + v.id, onclick: function () { removeLocal('voices', v.id); } }, 'Withdraw') : null),
            h('p', null, v.reasoning),
            v.citation ? h('div', { class: 'cite' }, v.citation, v.verified === true ? '' : [' ', h('span', { class: 'tag warn' }, 'citation unverified')]) : null);
    }

    // ---------- reader actions ----------
    function choose(crux, p) {
        if (p === C.foregrounded(crux)) delete S.local.choices[crux.id]; else S.local.choices[crux.id] = p.id;
        var was = S.mode; S.mode = 'mine'; save(); draw();
        say('Your text now reads “' + p.label + '”.' + (was !== 'mine' ? ' Switched to reading your own text.' : ''));
    }
    function removeLocal(kind, id) {
        S.local[kind] = S.local[kind].filter(function (x) { return x.id !== id; });
        if (kind === 'positions') Object.keys(S.local.choices).forEach(function (c) { if (S.local.choices[c] === id) delete S.local.choices[c]; });
        if (kind === 'cruxes') delete S.local.choices[id];
        save(); draw(); say('Withdrawn.');
    }
    function field(label, control, hint) { return h('label', null, label, control, hint ? h('span', { class: 'hint' }, hint) : null); }
    function formShell(title, fields, submitLabel, onSubmit) {
        var err = h('div', { class: 'err', role: 'alert' });
        var f = h('form', { class: 'f', novalidate: true, onsubmit: function (e) {
            e.preventDefault();
            var msg = onSubmit(f);
            if (msg) err.textContent = msg;
        } }, h('strong', { class: 'meta' }, title), fields,
            field('Your name, as it should appear', h('input', { type: 'text', name: 'who', value: S.name, autocomplete: 'name' })),
            err,
            h('span', { class: 'hint' }, 'Saved in this browser only. Use “About this edition” to export it for the editor.'),
            h('div', { class: 'acts' }, h('button', { type: 'submit', class: 'btn solid' }, submitLabel),
                h('button', { type: 'button', class: 'btn', onclick: function () { S.form = null; drawPanel(); } }, 'Cancel')));
        return f;
    }
    function val(f, n) { return (f.elements[n].value || '').trim(); }
    function needName(f) { var n = val(f, 'who'); if (n) S.name = n; return n; }
    function voiceForm(crux, p) {
        return formShell('Argue for “' + p.label + '”', field('Your reasoning', h('textarea', { name: 'why' }), 'Evidence from a document, an argument from the text, or a published discussion.'), 'Save my voice', function (f) {
            if (val(f, 'why').length < 20) return 'Give your reasoning in a sentence or more. The variorum holds reasoned readings, not votes.';
            if (!needName(f)) return 'Add your name.';
            S.local.voices.push({ id: uid(), cruxId: crux.id, positionId: p.id, name: S.name, date: today(), reasoning: val(f, 'why') });
            S.form = null; save(); draw(); say('Your voice was saved in this browser.');
        });
    }
    function positionForm(crux) {
        var whole = crux.positions.some(function (p) { return p.text; });
        return formShell('Propose another reading', [
            field(whole ? 'The stanza as you would read it' : 'The reading', whole ? h('textarea', { name: 'text' }) : h('input', { type: 'text', name: 'text' })),
            whole ? field('A short name for it', h('input', { type: 'text', name: 'label' })) : null,
            field('Your reasoning', h('textarea', { name: 'why' }), 'Say where the reading comes from: a document, an edition, or your own conjecture.')
        ], 'Save this reading', function (f) {
            var text = whole ? f.elements.text.value.replace(/\s+$/, '') : val(f, 'text');
            if (!text.trim()) return 'Give the reading.';
            if (val(f, 'why').length < 20) return 'Say why, in a sentence or more.';
            if (!needName(f)) return 'Add your name.';
            var label = whole ? (val(f, 'label') || text.split('\n')[0]) : text;
            if (crux.positions.some(function (p) { return p.label === label; })) return 'That reading is already listed. You can argue for it instead.';
            var p = { id: uid(), cruxId: crux.id, label: label, voices: [{ kind: 'contributed', name: S.name, date: today(), reasoning: val(f, 'why') }] };
            if (whole) p.text = text;
            S.local.positions.push(p); S.form = null; save(); draw(); say('Your reading was saved in this browser.');
        });
    }
    function proposeForm(pre) {
        var lines = [];
        S.base.reading.stanzas.forEach(function (s) {
            (s.lines || []).forEach(function (line, li) {
                var plain = C.parseLine(line).segs.map(function (g) { return g.t === 'text' ? g.s : '[…]'; }).join('');
                lines.push({ st: s.id, li: li, plain: plain });
            });
        });
        var want = pre && pre.st ? pre.st + '|' + pre.li : '';
        return formShell('Propose a crux', [
            field('Line', h('select', { name: 'line' }, lines.map(function (l, i) { var v = l.st + '|' + l.li; return h('option', { value: v, selected: v === want }, (i + 1) + '  ' + l.plain); }))),
            field('The word or words in question', h('input', { type: 'text', name: 'phrase', value: (pre && pre.phrase) || '' }), 'Exactly as they stand in that line.'),
            field('The reading you propose instead', h('input', { type: 'text', name: 'alt' })),
            field('Your reasoning', h('textarea', { name: 'why' }), 'Why is this worth contesting, and where does your reading come from?')
        ], 'Save this crux', function (f) {
            var parts = f.elements.line.value.split('|'), st = parts[0], li = +parts[1], phrase = val(f, 'phrase'), alt = val(f, 'alt');
            var stanza = S.base.reading.stanzas.filter(function (s) { return s.id === st; })[0];
            if (!phrase) return 'Give the word or words in question.';
            if (C.applyAnchors(C.parseLine(stanza.lines[li]).segs, [{ id: 'x', phrase: phrase }]).missing.length) return '“' + phrase + '” does not occur in that line outside an existing crux. Copy it exactly from the line.';
            if (!alt) return 'Give the reading you propose.';
            if (alt === phrase) return 'The proposed reading is the same as the text.';
            if (val(f, 'why').length < 20) return 'Say why, in a sentence or more.';
            if (!needName(f)) return 'Add your name.';
            var id = uid();
            S.local.cruxes.push({ id: id, label: 'Proposed crux', anchor: { stanzaId: st, line: li, phrase: phrase }, positions: [
                { id: 'text', label: phrase, foregrounded: true },
                { id: 'alt', label: alt, voices: [{ kind: 'contributed', name: S.name, date: today(), reasoning: val(f, 'why') }] }] });
            S.form = null; S.panel = { type: 'crux', id: id }; if (S.depth < 3) S.depth = 3;
            save(); draw(); say('Your crux was saved in this browser.');
        });
    }
    // Select words in the reading text to propose a crux on them.
    var floater = null;
    function dropFloater() { if (floater) { floater.remove(); floater = null; } }
    document.addEventListener('mouseup', function (e) {
        if (floater && floater.contains(e.target)) return;
        dropFloater();
        if (!S || S.depth < 2) return;
        setTimeout(function () {
            var sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) return;
            var line = function (n) { n = n.nodeType === 1 ? n : n.parentElement; return n && n.closest('.rd .line[data-st]'); };
            var a = line(sel.anchorNode), b = line(sel.focusNode), phrase = sel.toString().trim();
            if (!a || a !== b || !phrase || phrase.length > 80) return;
            var rect = sel.getRangeAt(0).getBoundingClientRect();
            floater = h('button', { type: 'button', class: 'float-propose', style: 'left:' + (rect.left + window.scrollX) + 'px;top:' + (rect.bottom + window.scrollY + 6) + 'px',
                onclick: function () { var pre = { st: a.getAttribute('data-st'), li: +a.getAttribute('data-li'), phrase: phrase }; dropFloater(); sel.removeAllRanges(); openPanel({ type: 'propose', pre: pre }); } }, 'Propose a crux here');
            document.body.appendChild(floater);
        }, 0);
    });

    // ---------- panel ----------
    var opener = null;
    function openPanel(p, fromKey) {
        if (fromKey !== undefined) opener = fromKey;
        S.panel = p; S.form = null; drawPanel();
        focusIn('h2');
    }
    function closePanel(silent) {
        if (!S || !S.panel) { panel.hidden = true; document.body.classList.remove('panel-open'); return; }
        S.panel = null; S.form = null; drawPanel();
        if (!silent && opener) { var el = document.querySelector('[data-fk="' + opener + '"]'); if (el) el.focus(); }
    }
    function focusIn(sel) { var el = panel.querySelector(sel); if (el) el.focus(); }
    function drawPanel() {
        clear(panel);
        var p = S && S.panel;
        panel.hidden = !p; document.body.classList.toggle('panel-open', !!p);
        if (!p) return;
        var body, label;
        if (p.type === 'crux') {
            var crux = C.findCrux(S.work, p.id);
            if (!crux) { S.panel = null; return drawPanel(); }
            body = cruxBody(crux, true); label = 'Apparatus for ' + crux.label;
        } else if (p.type === 'witness') { body = h('div', null, witnessBody(C.findWitness(S.work, p.id), 'h2')); label = 'Witness'; }
        else if (p.type === 'propose') { body = h('div', null, h('h2', { tabindex: '-1' }, 'Propose a crux'), h('p', null, 'A crux is a place where the text could read otherwise. Yours is kept in this browser until you export it for the editor.'), proposeForm(p.pre)); label = 'Propose a crux'; }
        else { body = aboutBody(); label = 'About this edition'; }
        panel.setAttribute('aria-label', label);
        panel.appendChild(h('div', { class: 'panel-top' },
            p.back ? h('button', { type: 'button', class: 'btn', 'data-fk': 'pback', onclick: function () { openPanel(p.back); } }, '← Back to the crux') : h('span'),
            h('button', { type: 'button', class: 'btn', 'data-fk': 'pclose', onclick: function () { closePanel(); } }, 'Close')));
        panel.appendChild(body);
    }
    function aboutBody() {
        var w = S.work, ed = w.edition || {}, st = C.stats(w), box = h('div');
        box.appendChild(h('h2', { tabindex: '-1' }, 'About this edition'));
        box.appendChild(h('dl', null,
            h('dt', null, 'Editor'), h('dd', null, ed.editor || 'not recorded'),
            h('dt', null, 'State'), h('dd', null, ed.status === 'reviewed' ? 'Reviewed' : 'Draft'),
            ed.updated ? [h('dt', null, 'Updated'), h('dd', null, ed.updated)] : null));
        if (ed.note) box.appendChild(h('p', null, ed.note));
        box.appendChild(h('h3', { class: 'sub' }, 'How far to trust it'));
        box.appendChild(h('dl', null,
            h('dt', null, 'Cruxes'), h('dd', null, st.cruxes + ', with ' + plural(st.positions, 'reading')),
            h('dt', null, 'Attributions'), h('dd', null, st.attestations + ' to a witness; ' + st.unverifiedAttestations + ' not yet checked against the document (shown as ?)'),
            h('dt', null, 'Conjectures'), h('dd', null, String(st.conjectures)),
            h('dt', null, 'Voices'), h('dd', null, st.voices.attested + ' published (' + st.unverifiedCitations + ' with unchecked citations), ' + st.voices.contributed + ' from readers, ' + st.voices.illustrative + ' illustrative')));
        box.appendChild(h('p', null, 'A reading is attested when a document carries it and a conjecture when none does. A voice is published when it cites where the argument appeared, illustrative when it was invented to show the form, and a reader’s when it was added here.'));
        box.appendChild(h('h3', { class: 'sub' }, 'Your additions'));
        var n = localCount();
        box.appendChild(h('p', null, n ? 'You have ' + plural(Object.keys(S.local.choices).length, 'chosen reading') + ', ' + plural(S.local.voices.length, 'voice') + ', ' + plural(S.local.positions.length, 'proposed reading') + ' and ' + plural(S.local.cruxes.length, 'proposed crux', 'proposed cruxes') + '. They are stored in this browser and nowhere else; nobody else can see them until you send them to the editor.'
            : 'Nothing yet. Choose a reading, argue for one, or propose a crux; your additions stay in this browser until you export them.'));
        var bad = S.orphans.length + S.missing.length;
        if (bad) box.appendChild(h('p', null, h('span', { class: 'tag warn' }, 'note'), ' ' + plural(bad, 'addition') + ' of yours could not be placed, because the edition changed underneath. They are still in the export.'));
        if (n) {
            var out = h('textarea', { class: 'export', readonly: true, hidden: true, 'aria-label': 'Your contributions as JSON' });
            var json = function () { return JSON.stringify({ variorumContribution: 1, work: S.id, schemaVersion: S.base.schemaVersion, exported: new Date().toISOString(), name: S.name, choices: S.local.choices, voices: S.local.voices, positions: S.local.positions, cruxes: S.local.cruxes }, null, 2); };
            box.appendChild(h('div', { class: 'acts' },
                h('button', { type: 'button', class: 'btn', 'data-fk': 'exp', onclick: function () {
                    out.value = json(); out.hidden = false; out.focus(); out.select();
                    try { navigator.clipboard.writeText(out.value).then(function () { say('Copied to the clipboard.'); }, function () {}); } catch (e) {}
                    try { var a = h('a', { href: URL.createObjectURL(new Blob([out.value], { type: 'application/json' })), download: S.id + '-contribution.json' }); document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
                } }, 'Export for the editor'),
                h('button', { type: 'button', class: 'btn', 'data-fk': 'clr', onclick: function (e) {
                    if (e.target.getAttribute('data-sure')) { S.local = { choices: {}, voices: [], positions: [], cruxes: [] }; S.mode = 'editor'; save(); draw(); say('Your additions were deleted.'); }
                    else { e.target.setAttribute('data-sure', '1'); e.target.textContent = 'Delete all my additions: press again to confirm'; }
                } }, 'Delete all my additions')));
            box.appendChild(out);
            box.appendChild(h('p', { class: 'meta' }, 'Export copies the file to your clipboard and downloads it. Send it to the editor, or attach it to an issue in the ', h('a', { href: REPO }, 'repository'), '.'));
        }
        box.appendChild(h('h3', { class: 'sub' }, 'Keys'));
        box.appendChild(h('p', null, '1 to 4 change how much of the apparatus is shown. Escape closes this panel. Select words in the reading text to propose a crux on them.'));
        return box;
    }

    route();
})();
