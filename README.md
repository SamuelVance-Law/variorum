# Variorum

A platform for digital scholarly variorums — editions that preserve textual variants alongside the reasoning of their editors, with the editorial collective made explicit. Four works are seeded, each pressing a different kind of crux: Emily Dickinson's *Safe in their Alabaster Chambers* (Fr124), a manuscript-history variorum of a short lyric; Shakespeare's *Sonnet 116*, an editorial-history variorum tracing Q1609 against four centuries of print editions; the First Duino Elegy of Rainer Maria Rilke, a translation variorum of the German original against five English renderings; and Sappho 31, a reconstruction-and-translation variorum carrying Catullus's Latin imitation alongside five English translations and preserving the loci desperati of the corrupt Greek transmission.

## What's in this directory

```
variorum/
  index.html               # landing page — lists available works
  viewer.html              # the variorum viewer — content-agnostic engine
  schema.md                # the contract between work files and the engine
  validate.py              # pre-deploy validator for work files
  README.md                # this file
  works/
    _template.json         # skeleton for new works
    fr124.json             # Dickinson · manuscript-history variorum
    fr124/                 # per-work assets, in a folder named by work-id
      fascicle-6.jpg       #   manuscript image for fr124
    sonnet-116.json        # Shakespeare · editorial-history variorum
    sonnet-116/            #
      q1609.jpg            #   Q1609 facsimile for sonnet-116
    rilke-elegie-1.json    # Rilke · translation variorum
    sappho-31.json         # Sappho · reconstruction + translation variorum
  .github/workflows/
    validate.yml           # CI — runs the validator on every push
```

Two folders matter going forward: `works/` (which holds both the JSON files and per-work asset directories named by work-id) and `.github/workflows/` (where GitHub requires its actions to live). Everything else sits at root.

The landing page (`index.html`) is the public front door — it lists available works and invites new ones. The viewer (`viewer.html`) is the actual variorum engine; it fetches a work file from `works/<id>.json` at boot, validates schema and referential integrity, then renders. To add another work, write a JSON file (and place any associated assets in a `works/<id>/` subdirectory).

## Run it locally

The viewer uses `fetch()` to load the work file, which means browsers block it under `file://`. You need a static server. Easiest option:

```bash
cd variorum
python3 -m http.server 8765
```

Then open `http://localhost:8765`. To open a specific work directly, visit `http://localhost:8765/viewer.html?work=<id>`.

## Deploy it

This is a static site. Push the directory to a GitHub repo, point Cloudflare Pages at it, and every commit to `main` auto-deploys. The repo's root should match the structure above; no build step is needed.

## Add a new work

1. Read `schema.md` — it's the contract. Five entities, one mode-specific bit (the anchor on a crux), one optional manuscript image.
2. Copy `works/_template.json` to `works/<your-id>.json` and replace the placeholder content. The template is a valid skeleton; it will already pass the validator.
3. If you have a manuscript image, place it in a `works/<your-id>/` subdirectory and reference it in the work file's `manuscriptRendering.image.src` (e.g. `works/<your-id>/manuscript.jpg`).
4. Validate before pushing:
   ```bash
   python3 validate.py works/<your-id>.json
   ```
5. Add an entry for the new work to `index.html` so visitors can find it.
6. Visit `viewer.html?work=<your-id>` to see it render.

The schema doc has a short authoring guide at the end.

## CI: validate on every push

`.github/workflows/validate.yml` runs the validator on every push or pull request that touches a work file. Since this project is edited in the GitHub browser UI, this is where the safety net most needs to live — a typo would otherwise auto-deploy via Cloudflare Pages.

## Validate before pushing

The validator checks every work file in one shot:

```bash
python3 validate.py works/*.json
```

It exits with non-zero if any file is broken, so it can guard a deploy pipeline. It catches missing required fields, broken references, duplicate ids, and structural issues.

The viewer runs the same referential checks at boot and shows precise errors in the load screen if anything is wrong — but catching them before deploy is faster.

## Schema and storage versioning

The viewer declares which schema version it supports (`SUPPORTED_SCHEMA` near the top of `viewer.html`). Work files declare their version in the top-level `schemaVersion` field. Mismatches produce a refusal-to-render with a clear error message, never silent breakage.

User state (endorsements, personal arrangements, identity) lives in `localStorage` under `variorum.<workId>.<storageVersion>`. The current storage version is `v2`. The viewer includes a one-time migration from `v1` to `v2` that runs at boot if pre-`v2` state is found; the original `v1` record is left in place as a safety net.

## What this is not

This is a working prototype with a real architecture, not yet a finished product. The roadmap from here to a polished cross-platform tool (Mac and Windows desktop apps via Tauri or Electron, shared server-side state for collaboration, native mobile, full a11y, undo history, real test coverage) is months of engineering. But every step uses what's already here — the data/engine separation, the schema, the JSON-as-document model. Nothing gets thrown out.

## Pointers

- `schema.md` — the data contract; sufficient to author a new work
- `viewer.html` — the renderer; well-commented section by section
- `validate.py` — what to run before pushing
- `index.html` — the landing page; edit to add new works to the listing
