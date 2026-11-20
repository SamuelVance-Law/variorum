/*
 * Variorum — work-file validator (schema 2.0).
 *
 * THE single implementation of the contract. The viewer runs it at boot,
 * CI runs it through tools/validate.mjs, and the unit tests exercise it.
 * There is deliberately no second copy in another language: schema.md
 * explains the contract in prose, this file enforces it.
 *
 * validate(work)            -> { errors: [...], warnings: [...] }
 * validateManifest(m, ids)  -> { errors: [...], warnings: [...] }
 *
 * Errors mean "will not render correctly" and block deploy.
 * Warnings mean "renders, but an editor almost certainly wants to look".
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.VariorumValidate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SCHEMA_VERSION = '2.0';
    var ID_RE = /^[a-z0-9][a-z0-9-]*$/;
    // {crux:id}  is a slot: the chosen reading is printed here.
    // {crux:id|words}  is a lemma: fixed words of this text that the crux is about.
    var MARK_RE = /\{crux:([^}|]+)(?:\|([^}]*))?\}/g;
    var VOICE_KINDS = ['illustrative', 'attested', 'contributed'];
    var EDITION_STATUS = ['draft', 'reviewed'];

    function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
    function str(v) { return typeof v === 'string' && v.trim() !== ''; }
    function lineText(line) { return typeof line === 'string' ? line : (isObj(line) ? line.text : null); }

    function marksIn(text) {
        var out = [], m;
        MARK_RE.lastIndex = 0;
        while ((m = MARK_RE.exec(text))) out.push({ id: m[1], lemma: m[2] === undefined ? null : m[2] });
        return out;
    }

    function validate(d) {
        var errors = [], warnings = [];
        function err(s) { errors.push(s); }
        function warn(s) { warnings.push(s); }

        if (!isObj(d)) { err('The work file must be a JSON object.'); return { errors: errors, warnings: warnings }; }

        if (d.schemaVersion !== SCHEMA_VERSION) {
            err('schemaVersion is ' + JSON.stringify(d.schemaVersion) + '; this engine reads "' + SCHEMA_VERSION + '".');
            return { errors: errors, warnings: warnings };
        }
        if (!str(d.id)) err('Missing "id".');
        else if (!ID_RE.test(d.id)) err('id "' + d.id + '" must be lowercase letters, digits and hyphens.');

        if (!isObj(d.work)) err('Missing "work" (title, author…).');
        else {
            if (!str(d.work.title)) err('work.title is required.');
            if (!str(d.work.author)) warn('work.author is empty.');
        }

        if (!isObj(d.edition)) warn('No "edition" block: the reader is not told who edited this apparatus or what state it is in.');
        else {
            if (EDITION_STATUS.indexOf(d.edition.status) === -1) err('edition.status must be one of: ' + EDITION_STATUS.join(', ') + '.');
            if (!str(d.edition.editor)) warn('edition.editor is empty.');
        }

        // ---- witnesses -------------------------------------------------
        var witnessIds = {}, sigla = {};
        if (!Array.isArray(d.witnesses) || !d.witnesses.length) {
            err('"witnesses" must be a non-empty array.');
        } else d.witnesses.forEach(function (w, i) {
            if (!isObj(w) || !str(w.id)) { err('witnesses[' + i + '] is missing an id.'); return; }
            if (!ID_RE.test(w.id)) err('witness id "' + w.id + '" must be lowercase letters, digits and hyphens.');
            if (witnessIds[w.id]) err('Duplicate witness id "' + w.id + '".');
            witnessIds[w.id] = w;
            if (!str(w.title)) err('witness "' + w.id + '" needs a title.');
            if (!str(w.siglum)) err('witness "' + w.id + '" needs a siglum (the short letter shown in the apparatus).');
            else {
                if (sigla[w.siglum]) err('Siglum "' + w.siglum + '" is used by both "' + sigla[w.siglum] + '" and "' + w.id + '". An apparatus is unreadable if sigla collide.');
                sigla[w.siglum] = w.id;
            }
            if (!str(w.kind)) warn('witness "' + w.id + '" has no kind (manuscript, letter, edition, translation…).');
            if (!str(w.context)) warn('witness "' + w.id + '" has no context: its entry will say nothing about why it matters.');
            if (w.image !== undefined) {
                if (!isObj(w.image) || !str(w.image.src)) err('witness "' + w.id + '".image needs a src.');
                else {
                    if (!str(w.image.alt)) warn('witness "' + w.id + '".image has no alt text.');
                    if (!str(w.image.credit)) warn('witness "' + w.id + '".image has no credit line (licences usually require one).');
                }
            }
        });

        (d.connections || []).forEach(function (c, i) {
            if (!isObj(c)) { err('connections[' + i + '] must be an object.'); return; }
            if (!witnessIds[c.from]) err('connections[' + i + '].from "' + c.from + '" is not a witness.');
            if (!witnessIds[c.to]) err('connections[' + i + '].to "' + c.to + '" is not a witness.');
        });

        // ---- cruxes ----------------------------------------------------
        var cruxIds = {};
        if (!Array.isArray(d.cruxes)) { err('"cruxes" must be an array (it may be empty).'); d = Object.assign({}, d, { cruxes: [] }); }
        d.cruxes.forEach(function (c, i) {
            if (!isObj(c) || !str(c.id)) { err('cruxes[' + i + '] is missing an id.'); return; }
            if (!ID_RE.test(c.id)) err('crux id "' + c.id + '" must be lowercase letters, digits and hyphens.');
            if (cruxIds[c.id]) err('Duplicate crux id "' + c.id + '".');
            cruxIds[c.id] = c;
            if (!str(c.label)) err('crux "' + c.id + '" needs a label.');
            var ps = Array.isArray(c.positions) ? c.positions : [];
            if (!ps.length) { err('crux "' + c.id + '" has no positions.'); return; }
            if (ps.length === 1) warn('crux "' + c.id + '" has a single position: nothing is contested yet.');
            var pids = {}, fg = 0;
            ps.forEach(function (p, pi) {
                var where = 'crux "' + c.id + '" position ' + (isObj(p) && str(p.id) ? '"' + p.id + '"' : '#' + pi);
                if (!isObj(p) || !str(p.id)) { err(where + ' is missing an id.'); return; }
                if (pids[p.id]) err('Duplicate position id "' + p.id + '" in crux "' + c.id + '".');
                pids[p.id] = true;
                if (!str(p.label)) err(where + ' needs a label.');
                if (p.foregrounded) fg++;
                var atts = p.attestations || [];
                if (!Array.isArray(atts)) { err(where + ': attestations must be an array.'); atts = []; }
                atts.forEach(function (a) {
                    if (!isObj(a) || !witnessIds[a.witnessId]) err(where + ': attestation names unknown witness "' + (a && a.witnessId) + '".');
                });
                if (!atts.length && !p.conjecture) warn(where + ' is attested by no witness and is not marked "conjecture": where does this reading come from?');
                if (atts.length && p.conjecture) warn(where + ' is marked "conjecture" but lists attestations.');
                var voices = p.voices || [];
                if (!Array.isArray(voices)) { err(where + ': voices must be an array.'); voices = []; }
                voices.forEach(function (v, vi) {
                    var vw = where + ' voice ' + (isObj(v) && str(v.name) ? '"' + v.name + '"' : '#' + vi);
                    if (!isObj(v)) { err(vw + ' must be an object.'); return; }
                    if (VOICE_KINDS.indexOf(v.kind) === -1) err(vw + ': kind must be one of ' + VOICE_KINDS.join(', ') + '.');
                    if (!str(v.name)) err(vw + ' needs a name.');
                    if (!str(v.reasoning)) err(vw + ' has no reasoning. The variorum holds reasoned readings, not bare votes.');
                    if (v.kind === 'attested' && !str(v.citation)) err(vw + ' is "attested" but has no citation. A published position must say where it was published.');
                });
            });
            if (fg !== 1) err('crux "' + c.id + '" has ' + fg + ' foregrounded positions (exactly one expected).');
        });

        // ---- texts -----------------------------------------------------
        // placed[cruxId] = { slot: n, lemma: n, stanza: n } in the READING text.
        var placed = {};
        function note(id, kind) { (placed[id] = placed[id] || { slot: 0, lemma: 0, stanza: 0 })[kind]++; }

        function checkText(name, t, isReading) {
            if (!isObj(t)) { err('"' + name + '" must be an object.'); return; }
            if (!Array.isArray(t.stanzas) || !t.stanzas.length) { err(name + '.stanzas must be a non-empty array.'); return; }
            var sids = {};
            t.stanzas.forEach(function (s, si) {
                var where = name + '.stanzas[' + si + ']';
                if (!isObj(s) || !str(s.id)) { err(where + ' is missing an id.'); return; }
                if (sids[s.id]) err('Duplicate stanza id "' + s.id + '" in ' + name + '.');
                sids[s.id] = true;
                if (s.crux !== undefined) {
                    if (!isReading) { err(where + ': only the reading text may hand a whole stanza to a crux.'); return; }
                    if (s.lines !== undefined) err(where + ' has both "lines" and "crux"; choose one.');
                    if (!cruxIds[s.crux]) { err(where + '.crux "' + s.crux + '" is not a crux.'); return; }
                    note(s.crux, 'stanza');
                    cruxIds[s.crux].positions.forEach(function (p) {
                        if (isObj(p) && !str(p.text)) err('crux "' + s.crux + '" fills a whole stanza, so position "' + p.id + '" needs a "text" (the full stanza).');
                    });
                    return;
                }
                if (!Array.isArray(s.lines)) { err(where + ' needs "lines" (or, in the reading text, "crux").'); return; }
                s.lines.forEach(function (line, li) {
                    var text = lineText(line);
                    if (typeof text !== 'string') { err(where + '.lines[' + li + '] must be a string or { "text": … }.'); return; }
                    var stripped = text.replace(MARK_RE, '');
                    if (/\{crux|\{|\}/.test(stripped)) err(where + '.lines[' + li + '] has a malformed crux mark: ' + JSON.stringify(text));
                    marksIn(text).forEach(function (m) {
                        if (!cruxIds[m.id]) { err(where + '.lines[' + li + '] marks unknown crux "' + m.id + '".'); return; }
                        if (m.lemma === null) {
                            if (!isReading) err(where + '.lines[' + li + ']: the source text is fixed, so mark its words as {crux:' + m.id + '|words}, not as an empty slot.');
                            else note(m.id, 'slot');
                        } else {
                            if (!m.lemma.trim()) err(where + '.lines[' + li + ']: lemma mark for "' + m.id + '" is empty.');
                            if (isReading) note(m.id, 'lemma');
                        }
                    });
                });
            });
        }

        if (d.reading === undefined) err('Missing "reading" (the text people read).');
        else checkText('reading', d.reading, true);

        if (d.source !== undefined) {
            checkText('source', d.source, false);
            if (isObj(d.source) && !witnessIds[d.source.witnessId]) err('source.witnessId "' + d.source.witnessId + '" is not a witness.');
        }

        Object.keys(cruxIds).forEach(function (id) {
            var p = placed[id];
            if (!p) { err('crux "' + id + '" is never placed in the reading text, so it will never render. Mark it with {crux:' + id + '} in a line, or give a stanza "crux": "' + id + '".'); return; }
            var kinds = (p.slot ? 1 : 0) + (p.lemma ? 1 : 0) + (p.stanza ? 1 : 0);
            if (kinds > 1) err('crux "' + id + '" is placed in the reading text in more than one way (slot, lemma, stanza). Choose one.');
            if (p.slot > 1) err('crux "' + id + '" has ' + p.slot + ' slots in the reading text (exactly one expected).');
            if (p.stanza > 1) err('crux "' + id + '" fills ' + p.stanza + ' stanzas (exactly one expected).');
        });

        return { errors: errors, warnings: warnings };
    }

    // works/index.json lists the works the landing page shows. CI checks it
    // against the files actually present so the two can never drift.
    function validateManifest(m, presentIds) {
        var errors = [], warnings = [];
        if (!isObj(m) || !Array.isArray(m.works)) { errors.push('works/index.json must be { "works": [ … ] }.'); return { errors: errors, warnings: warnings }; }
        var listed = {};
        m.works.forEach(function (w, i) {
            if (!isObj(w) || !str(w.id)) { errors.push('index.json works[' + i + '] is missing an id.'); return; }
            if (listed[w.id]) errors.push('index.json lists "' + w.id + '" twice.');
            listed[w.id] = true;
            if (presentIds && presentIds.indexOf(w.id) === -1) errors.push('index.json lists "' + w.id + '" but works/' + w.id + '.json does not exist. The landing page would show a dead link.');
            if (!str(w.blurb)) warnings.push('index.json entry "' + w.id + '" has no blurb.');
        });
        (presentIds || []).forEach(function (id) {
            if (!listed[id]) warnings.push('works/' + id + '.json exists but is not listed in works/index.json, so the landing page will not show it.');
        });
        return { errors: errors, warnings: warnings };
    }

    return { SCHEMA_VERSION: SCHEMA_VERSION, MARK_RE: MARK_RE, validate: validate, validateManifest: validateManifest, marksIn: marksIn, lineText: lineText };
});
