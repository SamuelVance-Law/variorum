// Run with:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const V = require('../engine/validate.js');
const C = require('../engine/core.js');
const load = id => JSON.parse(readFileSync(new URL(`../works/${id}.json`, import.meta.url), 'utf8'));
const tpl = () => load('_template');
const errs = d => V.validate(d).errors;
const has = (d, re) => assert.ok(errs(d).some(e => re.test(e)), `expected an error matching ${re}, got:\n${errs(d).join('\n')}`);

test('every shipped work is valid and listed in the manifest', () => {
    const ids = readdirSync(new URL('../works/', import.meta.url)).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_')).map(f => f.slice(0, -5));
    for (const id of ids) assert.deepEqual(errs(load(id)), [], id);
    const m = V.validateManifest(load('index'), ids);
    assert.deepEqual(m.errors, []); assert.deepEqual(m.warnings, []);
});
test('the template is valid', () => assert.deepEqual(errs(tpl()), []));

test('a crux that is never placed in the reading text is an error', () => {
    const d = tpl(); d.reading.stanzas[0].lines[1] = 'second line with a contested word.';
    has(d, /never placed/);
});
test('a crux placed twice is an error', () => {
    const d = tpl(); d.reading.stanzas[0].lines[0] = 'First {crux:example} line';
    has(d, /2 slots/);
});
test('unknown references are errors', () => {
    let d = tpl(); d.cruxes[0].positions[0].attestations[0].witnessId = 'nobody'; has(d, /unknown witness "nobody"/);
    d = tpl(); d.source.witnessId = 'nobody'; has(d, /source\.witnessId/);
    d = tpl(); d.connections[0].to = 'nobody'; has(d, /connections\[0\]\.to/);
    d = tpl(); d.source.stanzas[0].lines[1] = 'x {crux:ghost|y}'; has(d, /unknown crux "ghost"/);
});
test('exactly one foregrounded position', () => {
    let d = tpl(); d.cruxes[0].positions[1].foregrounded = true; has(d, /2 foregrounded/);
    d = tpl(); delete d.cruxes[0].positions[0].foregrounded; has(d, /0 foregrounded/);
});
test('voices need reasoning; attested voices need a citation', () => {
    let d = tpl(); d.cruxes[0].positions[1].voices[0].reasoning = ' '; has(d, /no reasoning/);
    d = tpl(); delete d.cruxes[0].positions[1].voices[0].citation; has(d, /no citation/);
    d = tpl(); d.cruxes[0].positions[1].voices[0].kind = 'vote'; has(d, /kind must be/);
});
test('colliding sigla are an error', () => {
    const d = tpl(); d.witnesses[1].siglum = 'A'; has(d, /Siglum "A"/);
});
test('the source text may not contain empty slots; stanza cruxes need full texts', () => {
    let d = tpl(); d.source.stanzas[0].lines[1] = 'x {crux:example} y'; has(d, /source text is fixed/);
    d = tpl(); d.reading.stanzas[0] = { id: 's1', crux: 'example' }; has(d, /needs a "text"/);
});
test('malformed marks and wrong schema version are caught', () => {
    let d = tpl(); d.reading.stanzas[0].lines[0] = 'broken {crux:example mark'; has(d, /malformed/);
    d = tpl(); d.schemaVersion = '1.0'; has(d, /schemaVersion/);
});
test('an unsupported reading is a warning, not an error', () => {
    const d = tpl(); d.cruxes[0].positions[1].attestations = [];
    const r = V.validate(d); assert.deepEqual(r.errors, []); assert.ok(r.warnings.some(w => /attested by no witness/.test(w)));
});
test('manifest: dead links are errors, unlisted works are warnings', () => {
    assert.ok(V.validateManifest({ works: [{ id: 'gone', blurb: 'x' }] }, []).errors.some(e => /dead link/.test(e)));
    assert.ok(V.validateManifest({ works: [] }, ['here']).warnings.some(w => /not listed/.test(w)));
});

test('parseLine splits text, slots and lemmas', () => {
    assert.deepEqual(C.parseLine('a {crux:x} b {crux:y|two words}.').segs,
        [{ t: 'text', s: 'a ' }, { t: 'slot', id: 'x' }, { t: 'text', s: ' b ' }, { t: 'lemma', id: 'y', s: 'two words' }, { t: 'text', s: '.' }]);
    assert.equal(C.parseLine({ text: 'x', indent: true }).indent, true);
});
test('applyAnchors wraps the first occurrence and reports misses', () => {
    const r = C.applyAnchors(C.parseLine('the meek members, the meek').segs, [{ id: 'u1', phrase: 'meek' }, { id: 'u2', phrase: 'absent' }]);
    assert.deepEqual(r.segs, [{ t: 'text', s: 'the ' }, { t: 'slot', id: 'u1' }, { t: 'text', s: ' members, the meek' }]);
    assert.deepEqual(r.missing, ['u2']);
});
test('resolve: editor, witness and personal readings', () => {
    const w = load('rilke-elegie-1'), crux = C.findCrux(w, 'engel-ordnungen');
    assert.equal(C.resolve(crux, 'editor').position.id, 'hierarchies');
    assert.equal(C.resolve(crux, 'w:snow-2000').position.id, 'orders');
    assert.equal(C.resolve(crux, 'w:gass-1999').position.id, 'dominions');
    const silent = C.resolve(crux, 'w:crucefix-2006');
    assert.equal(silent.position.id, 'hierarchies'); assert.equal(silent.fallback, true);
    assert.equal(C.resolve(crux, 'mine', { 'engel-ordnungen': 'orders' }).position.id, 'orders');
    assert.equal(C.resolve(crux, 'mine', {}).fallback, true);
});
test('mergeOverlay adds local material without touching the original, and reports orphans', () => {
    const w = load('fr124'), before = JSON.stringify(w);
    const { work, orphans } = C.mergeOverlay(w, {
        voices: [{ id: 'v1', cruxId: 'verb', positionId: 'lie', name: 'Me', date: '2026-11-20', reasoning: 'because' },
                 { id: 'v2', cruxId: 'verb', positionId: 'gone', name: 'Me', reasoning: 'x' }],
        positions: [{ cruxId: 'verb', id: 'u-rest', label: 'Rest', foregrounded: true }],
        cruxes: [{ id: 'u-meek', label: 'meek', anchor: { stanzaId: 'stanza1', line: 3, phrase: 'meek' }, positions: [{ id: 'a', label: 'meek', foregrounded: true }, { id: 'b', label: 'weak' }] }]
    });
    assert.equal(JSON.stringify(w), before);
    const verb = C.findCrux(work, 'verb');
    assert.ok(C.findPosition(verb, 'lie').voices.some(v => v.local && v.kind === 'contributed'));
    assert.equal(C.findPosition(verb, 'u-rest').foregrounded, false, 'a local reading can never displace the editor\'s');
    assert.equal(C.foregrounded(verb).id, 'sleep');
    assert.ok(C.findCrux(work, 'u-meek').local);
    assert.equal(orphans.length, 1);
});
test('stats count what is unverified', () => {
    const s = C.stats(load('sappho-31'));
    assert.equal(s.attestations, s.unverifiedAttestations);
    assert.ok(s.voices.illustrative > 0); assert.equal(s.voices.attested, 0);
});
test('readableWitnesses lists only witnesses that attest a reading', () => {
    const ids = C.readableWitnesses(load('rilke-elegie-1')).map(x => x.witness.id);
    assert.ok(ids.includes('mitchell-1982')); assert.ok(!ids.includes('duineser-1923'));
});
