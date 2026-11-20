#!/usr/bin/env node
// Validate work files and the works/index.json manifest.
//
//   node tools/validate.mjs            every works/*.json, plus the manifest
//   node tools/validate.mjs works/x.json [...]
//
// Exits non-zero on any error, so it can gate a deploy (see README).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { validate, validateManifest } = createRequire(import.meta.url)(join(root, 'engine/validate.js'));

const args = process.argv.slice(2);
const all = args.length === 0;
const files = all
    ? readdirSync(join(root, 'works')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => join(root, 'works', f))
    : args;

let errorCount = 0, warningCount = 0;
function report(label, res, okNote) {
    if (res.errors.length) {
        console.log(`  ✗  ${label}: ${res.errors.length} error${res.errors.length === 1 ? '' : 's'}`);
        res.errors.forEach(e => console.log(`       · ${e}`));
    } else console.log(`  ✓  ${label}${okNote ? '  →  ' + okNote : ''}`);
    res.warnings.forEach(w => console.log(`       ⚠  ${w}`));
    errorCount += res.errors.length; warningCount += res.warnings.length;
}

const presentIds = [];
for (const file of files) {
    const label = file.replace(root + '/', '');
    let data;
    try { data = JSON.parse(readFileSync(file, 'utf8')); }
    catch (e) { report(label, { errors: ['Not valid JSON — ' + e.message], warnings: [] }); continue; }
    const res = validate(data);
    const stem = basename(file, '.json');
    if (!stem.startsWith('_')) {
        presentIds.push(stem);
        if (data && data.id !== stem) res.errors.push(`id is "${data.id}" but the file is named ${stem}.json; the viewer opens works by file name.`);
        const img = (data.witnesses || []).map(w => w.image && w.image.src).filter(Boolean);
        img.forEach(src => { if (!existsSync(join(root, src))) res.errors.push(`image "${src}" does not exist in the repository.`); });
    }
    report(label, res, data && data.work ? `${data.id}: ${data.work.title}` : '');
}

if (all) {
    const mf = join(root, 'works/index.json');
    try { report('works/index.json', validateManifest(JSON.parse(readFileSync(mf, 'utf8')), presentIds)); }
    catch (e) { report('works/index.json', { errors: ['Missing or not valid JSON — ' + e.message], warnings: [] }); }
}

if (warningCount) console.log(`\n${warningCount} warning${warningCount === 1 ? '' : 's'} (advisory; they do not block a deploy)`);
process.exit(errorCount ? 1 : 0);
