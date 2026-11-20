/*
 * Variorum — core logic (no DOM).
 *
 * Everything the viewer decides about a work — how a line breaks into
 * text and crux marks, which reading shows under "read as…", how a
 * reader's local contributions fold into the editor's apparatus, how
 * much of the apparatus is still unverified — lives here as pure
 * functions, so it can be unit-tested in Node without a browser.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.VariorumCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MARK_RE = /\{crux:([^}|]+)(?:\|([^}]*))?\}/g;

    // "a {crux:x} b {crux:y|words}" ->
    //   [ {t:'text',s:'a '}, {t:'slot',id:'x'}, {t:'text',s:' b '}, {t:'lemma',id:'y',s:'words'} ]
    function parseLine(line) {
        var text = typeof line === 'string' ? line : (line && line.text) || '';
        var indent = !!(line && typeof line === 'object' && line.indent);
        var segs = [], last = 0, m;
        MARK_RE.lastIndex = 0;
        while ((m = MARK_RE.exec(text))) {
            if (m.index > last) segs.push({ t: 'text', s: text.slice(last, m.index) });
            if (m[2] === undefined) segs.push({ t: 'slot', id: m[1] });
            else segs.push({ t: 'lemma', id: m[1], s: m[2] });
            last = m.index + m[0].length;
        }
        if (last < text.length) segs.push({ t: 'text', s: text.slice(last) });
        return { indent: indent, segs: segs };
    }

    // A reader-proposed crux is anchored by quoting words of a line. Replace
    // the first occurrence of each anchored phrase in the plain-text segments
    // with a slot. Returns the new segments and the ids that could not be found
    // (the editor may have changed the line since the reader anchored to it).
    function applyAnchors(segs, anchors) {
        var missing = [];
        (anchors || []).forEach(function (a) {
            var done = false, out = [];
            segs.forEach(function (seg) {
                var at = (!done && seg.t === 'text') ? seg.s.indexOf(a.phrase) : -1;
                if (at === -1) { out.push(seg); return; }
                done = true;
                if (at > 0) out.push({ t: 'text', s: seg.s.slice(0, at) });
                out.push({ t: 'slot', id: a.id });
                var rest = seg.s.slice(at + a.phrase.length);
                if (rest) out.push({ t: 'text', s: rest });
            });
            if (!done) missing.push(a.id);
            segs = out;
        });
        return { segs: segs, missing: missing };
    }

    function clone(v) { return JSON.parse(JSON.stringify(v)); }

    function findCrux(work, id) {
        for (var i = 0; i < work.cruxes.length; i++) if (work.cruxes[i].id === id) return work.cruxes[i];
        return null;
    }
    function findPosition(crux, id) {
        for (var i = 0; crux && i < crux.positions.length; i++) if (crux.positions[i].id === id) return crux.positions[i];
        return null;
    }
    function findWitness(work, id) {
        for (var i = 0; i < work.witnesses.length; i++) if (work.witnesses[i].id === id) return work.witnesses[i];
        return null;
    }
    function foregrounded(crux) {
        for (var i = 0; i < crux.positions.length; i++) if (crux.positions[i].foregrounded) return crux.positions[i];
        return crux.positions[0];
    }

    // Fold a reader's local contributions into a copy of the editor's work.
    // Everything local is flagged `local: true` so the viewer can mark it and
    // so nothing local is ever mistaken for the published apparatus.
    // Contributions whose target no longer exists are returned as orphans
    // rather than silently dropped.
    function mergeOverlay(work, overlay) {
        var w = clone(work), orphans = [];
        overlay = overlay || {};
        (overlay.cruxes || []).forEach(function (c) {
            if (findCrux(w, c.id)) return;
            var copy = clone(c); copy.local = true;
            copy.positions.forEach(function (p) { p.local = true; (p.voices || []).forEach(function (v) { v.local = true; }); });
            w.cruxes.push(copy);
        });
        (overlay.positions || []).forEach(function (p) {
            var crux = findCrux(w, p.cruxId);
            if (!crux) { orphans.push({ type: 'position', item: p }); return; }
            if (findPosition(crux, p.id)) return;
            var copy = clone(p); delete copy.cruxId; copy.local = true; copy.foregrounded = false;
            (copy.voices || []).forEach(function (v) { v.local = true; });
            crux.positions.push(copy);
        });
        (overlay.voices || []).forEach(function (v) {
            var pos = findPosition(findCrux(w, v.cruxId), v.positionId);
            if (!pos) { orphans.push({ type: 'voice', item: v }); return; }
            pos.voices = pos.voices || [];
            pos.voices.push({ id: v.id, kind: 'contributed', name: v.name, date: v.date, reasoning: v.reasoning, local: true });
        });
        return { work: w, orphans: orphans };
    }

    // Which reading shows at a crux?
    //   mode 'editor'       the editor's foregrounded reading
    //   mode 'mine'         the reader's own choice, else the editor's
    //   mode 'w:<witness>'  the reading that witness attests, else the editor's
    // `fallback` is true when the mode had nothing to say at this crux, so the
    // viewer can show that honestly instead of implying the witness reads so.
    function resolve(crux, mode, choices) {
        var fg = foregrounded(crux);
        if (mode === 'mine') {
            var mine = findPosition(crux, (choices || {})[crux.id]);
            return { position: mine || fg, fallback: !mine };
        }
        if (mode && mode.indexOf('w:') === 0) {
            var wid = mode.slice(2);
            for (var i = 0; i < crux.positions.length; i++) {
                var atts = crux.positions[i].attestations || [];
                for (var j = 0; j < atts.length; j++) if (atts[j].witnessId === wid) return { position: crux.positions[i], fallback: false };
            }
            return { position: fg, fallback: true };
        }
        return { position: fg, fallback: false };
    }

    // Witnesses that attest at least one reading, in file order: the ones it
    // makes sense to "read as".
    function readableWitnesses(work) {
        var seen = {};
        work.cruxes.forEach(function (c) {
            c.positions.forEach(function (p) { (p.attestations || []).forEach(function (a) { seen[a.witnessId] = (seen[a.witnessId] || 0) + 1; }); });
        });
        return work.witnesses.filter(function (w) { return seen[w.id]; }).map(function (w) { return { witness: w, count: seen[w.id] }; });
    }

    // Where each witness is cited: [{ crux, position, attestation }]
    function attestationsOf(work, witnessId) {
        var out = [];
        work.cruxes.forEach(function (c) {
            c.positions.forEach(function (p) {
                (p.attestations || []).forEach(function (a) { if (a.witnessId === witnessId) out.push({ crux: c, position: p, attestation: a }); });
            });
        });
        return out;
    }

    // How much of the apparatus can a reader rely on? Shown in the edition
    // statement, so an unchecked draft never passes itself off as finished.
    function stats(work) {
        var s = { cruxes: work.cruxes.length, positions: 0, attestations: 0, unverifiedAttestations: 0, conjectures: 0, unsupported: 0,
                  voices: { illustrative: 0, attested: 0, contributed: 0 }, unverifiedCitations: 0 };
        work.cruxes.forEach(function (c) {
            c.positions.forEach(function (p) {
                s.positions++;
                var atts = p.attestations || [];
                s.attestations += atts.length;
                atts.forEach(function (a) { if (a.verified !== true) s.unverifiedAttestations++; });
                if (p.conjecture) s.conjectures++;
                else if (!atts.length && !p.local) s.unsupported++;
                (p.voices || []).forEach(function (v) {
                    if (s.voices[v.kind] !== undefined) s.voices[v.kind]++;
                    if (v.kind === 'attested' && v.verified !== true) s.unverifiedCitations++;
                });
            });
        });
        return s;
    }

    // The full text of a reading: `text` for stanza-sized readings, else the label.
    function readingText(position) { return position.text || position.label; }

    function slug(s) {
        return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
    }

    return {
        parseLine: parseLine, applyAnchors: applyAnchors, mergeOverlay: mergeOverlay, resolve: resolve,
        readableWitnesses: readableWitnesses, attestationsOf: attestationsOf, stats: stats,
        findCrux: findCrux, findPosition: findPosition, findWitness: findWitness,
        foregrounded: foregrounded, readingText: readingText, slug: slug, clone: clone
    };
});
