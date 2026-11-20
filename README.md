# Variorum

Editions that keep every contested reading in view, say which documents carry
it, and record who argues for it and why.

This is version 5: a reading-first viewer and schema 2.0. It is a working
prototype. The four seeded apparatuses are **drafts that have not been checked
against their sources**; see `REVIEW.md` before trusting any of them.

## What is here

```
index.html              the whole site: lists the works, or opens one (index.html#fr124)
viewer.html             redirect, so old links (viewer.html?work=fr124) still work
engine/
  validate.js           the contract, enforced. Used by the viewer, CI and the tests
  core.js               every decision about the data, with no DOM (unit-tested)
  viewer.js             drawing and interaction
  viewer.css
  fonts/                EB Garamond, Instrument Sans, JetBrains Mono (self-hosted, OFL)
works/
  index.json            which works the landing page lists, with their blurbs
  <id>.json             one file per work
  <id>/                 that work's images
  _template.json        a valid skeleton to copy
tools/validate.mjs      command-line validator
tests/core.test.mjs     unit tests (node --test)
tests/browser-check.mjs end-to-end check in Chrome (run by hand)
schema.md               the contract in prose
REVIEW.md               what the editor still has to check
```

There is no build step. The site is static files.

## How it reads

Four depths, on keys 1 to 4:

1. **Source**: the primary document alone, with its facsimile if there is one.
2. **Reading**: the reading text, cruxes underlined.
3. **Variants**: the margin apparatus (`lemma ] reading SIGLUM · reading SIGLUM`) and the witnesses.
4. **Voices**: every reading with every argument for it, as a document you can search and print.

**Read as** switches the text between the editor's choices, any one witness's
readings, and the reader's own. Choosing a reading in the panel edits your text.

A reader can argue for a reading, propose another reading, or propose a new crux
(select the words, or use the button under the text). These are stored in that
browser only, labelled as such, and exported as a JSON file from "About this
edition" so they can be sent to the editor. There is no shared state yet.

## Add or edit a work

1. Copy `works/_template.json` to `works/<id>.json` and fill it in (`schema.md`).
2. Add an entry to `works/index.json`.
3. Commit. CI runs the validator and the tests.

To check locally: `node tools/validate.mjs && node --test`.
To look at it locally: `python3 -m http.server` and open `http://localhost:8000`.

## Make validation gate the deploy

GitHub Actions runs the checks, but Cloudflare Pages deploys each push on its own
and does not wait for them. To make a failed check block the deploy, set in the
Pages project (Settings → Builds):

- Build command: `node tools/validate.mjs && node --test`
- Build output directory: `/`

A work file with errors then fails the build and the previous version stays live.
The viewer also validates at load and refuses a broken file with the same
messages, so a reader never sees a half-rendered apparatus.

## Not built yet

- Shared state and sign-in (ORCID is the natural identity). Voices are already
  shaped as records with a target, a kind, a name, a date and reasoning, so they
  can move to a server unchanged.
- Thresholds for promoting a reader's crux into the edition.
- Cruxes on anything but lines of text; facsimile regions; TEI export.
- The authoring tool, which predates schema 2.0 and should be rebuilt on
  `engine/validate.js` rather than its own copy of the rules.
