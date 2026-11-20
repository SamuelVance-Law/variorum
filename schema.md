# Variorum schema 2.0

A work is one JSON file, `works/<id>.json`. This page explains it;
`engine/validate.js` enforces it, and is the authority where they differ.

## The ideas

- A **witness** is a document: a manuscript, a letter, a printing, an edition, a
  translation. Never a reading.
- A **crux** is a place where the text could read otherwise.
- A **position** is one reading at a crux. Exactly one is `foregrounded`: the
  editor's choice.
- An **attestation** says a witness carries a position. It is `verified` only
  when someone has checked it against the document. Unverified attestations show
  a `?` everywhere.
- A position no witness carries is a `conjecture` and must say so.
- A **voice** argues for a position and always gives reasoning. Its `kind` says
  what it is: `attested` (published; a `citation` is required), `contributed` (a
  reader, through the site) or `illustrative` (invented to show the form, and
  labelled so).

## Top level

```json
{
  "schemaVersion": "2.0",
  "id": "fr124",
  "work":    { "title": "", "shortTitle": "", "author": "", "kind": "", "date": "", "language": "en" },
  "edition": { "editor": "", "status": "draft", "updated": "2026-11-20", "note": "" },
  "witnesses":   [ … ],
  "connections": [ … ],
  "source":  { … },
  "reading": { … },
  "cruxes":  [ … ]
}
```

`id` must equal the file name. `edition.status` is `draft` or `reviewed`; the
viewer shows it, with `edition.note`, under the title of every work.

## Witnesses

```json
{ "id": "sue-letter", "siglum": "S", "kind": "letter",
  "title": "Susan Dickinson to Emily Dickinson", "creator": "", "date": "ca. 1861",
  "citation": "Houghton Library, H B 74b",
  "summary": "", "quote": "", "context": "",
  "image": { "src": "works/fr124/x.jpg", "alt": "", "credit": "" } }
```

`siglum` is the short letter used in the apparatus; sigla must be unique.
`quote` is the document's own words; `summary` and `context` are the editor's.
`citation` is where the document is held or published.

`connections` record documentary links between witnesses:
`{ "from": "sue-letter", "to": "frostier-note", "relation": "answered by" }`.
They read as a sentence: *from* · relation · *to*.

## The two texts

`reading` is the text people read. `source` is optional: the primary document,
transcribed, shown alone at depth 1 and alongside the reading on request. Both
are stanzas of lines:

```json
"reading": { "lang": "en", "label": "Reading text", "stanzas": [
    { "id": "s1", "lines": [ "First line,", { "text": "an indented line", "indent": true } ] },
    { "id": "s2", "crux": "stanza2" } ] }
```

A crux is placed in the text with a mark:

| Mark | Where | Meaning |
|---|---|---|
| `{crux:id}` | reading | a slot: the chosen reading is printed here |
| `{crux:id\|words}` | source, or reading | a lemma: fixed words the crux is about |
| `"crux": "id"` on a stanza | reading | the whole stanza is the crux; each position needs a `text` |

Every crux must be placed in the reading text exactly once (a lemma may run
over a line break as two marks with the same id). A crux that is never placed
is an error, because it would never appear.

If `source` and `reading` have the same number of stanzas they are shown level,
stanza by stanza, and line by line where the line counts match.

For a translation, the source is the original with lemma marks on the contested
phrases, the reading is an English text with slots, and each crux carries the
original phrase as `lemma`.

## Cruxes

```json
{ "id": "verb", "label": "Stanza 1, line 4", "lemma": "", "note": "",
  "positions": [
    { "id": "sleep", "label": "Sleep", "foregrounded": true,
      "attestations": [ { "witnessId": "fascicle-6", "locus": "", "verified": false, "note": "" } ],
      "note": "The editor's account of the case for this reading.",
      "voices": [
        { "kind": "attested", "name": "", "date": "", "citation": "", "verified": false, "reasoning": "" } ] },
    { "id": "rest", "label": "Rest", "conjecture": true } ] }
```

`label` is what the apparatus prints; `text` is the full reading when it is
longer than its label (a stanza). `note` on a position is the editor speaking,
unsigned; a `voice` is someone else, named.

## What the validator checks

Errors (the viewer refuses the file; the build fails): missing or duplicate
ids; references to witnesses or cruxes that do not exist; a crux never placed,
or placed twice; not exactly one foregrounded position; colliding sigla; a voice
without reasoning; an attested voice without a citation; malformed marks; an
image file that is not in the repository; a manifest entry with no work file.

Warnings (advice): a reading with neither attestation nor `conjecture`; a
witness with no context; a crux with one position; an image without alt text or
credit; a work file missing from the manifest.

## Stable ids

A reader's saved choices and contributions refer to crux and position ids and,
for proposed cruxes, to stanza ids. Rename labels freely; do not rename ids once
a work is public. Contributions whose target has gone are kept and reported to
the reader, not discarded.

## A reader's export

"Export for the editor" produces:

```json
{ "variorumContribution": 1, "work": "fr124", "name": "", "exported": "",
  "choices":   { "<cruxId>": "<positionId>" },
  "voices":    [ { "cruxId": "", "positionId": "", "name": "", "date": "", "reasoning": "" } ],
  "positions": [ { "cruxId": "", "id": "", "label": "", "text": "", "voices": [ … ] } ],
  "cruxes":    [ { "id": "", "anchor": { "stanzaId": "", "line": 0, "phrase": "" }, "positions": [ … ] } ] }
```

To accept a voice, copy it into the position's `voices` with
`"kind": "contributed"`.
