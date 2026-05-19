# Variorum

A platform for digital scholarly variorums — editions that preserve textual variants rather than choosing among them, with the editorial collective made explicit. The first work is Emily Dickinson's *Safe in their Alabaster Chambers* (Fr124).

## What's in this directory

```
variorum/
  engine.html              # the renderer — content-agnostic
  works/
    fr124.json             # Dickinson · the first work
    _template.json         # skeleton for new works
  shared/
    schema.md              # the contract between work files and the engine
  tools/
    validate.py            # pre-deploy validator for work files
  .github/workflows/
    validate.yml           # CI — runs the validator on every push
  README.md                # this file
```

The engine is one HTML file with embedded CSS and JS. It fetches a work file from `works/<id>.json` at boot, validates the schema version and referential integrity, then renders. To add a second work, write a second JSON file.

## Run it locally

The engine uses `fetch()` to load the work file, which means browsers block it under `file://`. You need a static server. Easiest option:

```bash
cd variorum
python3 -m http.server 8765
```

Then open `http://localhost:8765/engine.html`. To load a different work, append `?work=<id>` to the URL.

## Deploy it

This is a static site. Push the directory to a GitHub repo, point Cloudflare Pages at it, and every commit to `main` auto-deploys. The repo's root should match the structure above; no build step is needed.

## Add a new work

1. Read `shared/schema.md` — it's the contract. Five entities, one mode-specific bit (the anchor on a crux).
2. Copy `works/_template.json` to `works/<your-id>.json` and replace the placeholder content. The template is a valid skeleton; it will already pass the validator.
3. Validate it before pushing:
   ```bash
   python3 tools/validate.py works/<your-id>.json
   ```
4. Visit `engine.html?work=<your-id>` to see it render.

The schema doc has a short authoring guide at the end.

## CI: validate on every push

`.github/workflows/validate.yml` runs the validator on every push or pull request that touches a work file. Since this project is edited in the GitHub browser UI, this is where the safety net most needs to live — a typo would otherwise auto-deploy via Cloudflare Pages.

## Validate before pushing

The validator checks every work file in one shot:

```bash
python3 tools/validate.py works/*.json
```

It exits with non-zero if any file is broken, so it can guard a deploy pipeline if you want one. It catches missing required fields, broken references (positions pointing at deleted witnesses, crux marks referencing missing cruxes, reading-copy placeholders that don't resolve), duplicate ids, and structural issues.

The engine runs the same referential checks at boot and shows precise errors in the load screen if anything is wrong — but catching them before deploy is faster.

## Schema and storage versioning

The engine declares which schema version it supports (`SUPPORTED_SCHEMA` near the top of `engine.html`). Work files declare their version in the top-level `schemaVersion` field. Mismatches produce a refusal-to-render with a clear error message, never silent breakage.

User state (endorsements, personal arrangements, identity) lives in `localStorage` under `variorum.<workId>.<storageVersion>`. The current storage version is `v2`. The engine includes a one-time migration from `v1` to `v2` that runs at boot if pre-`v2` state is found; the original `v1` record is left in place as a safety net.

## What this is not

This is a working prototype with a real architecture, not yet a finished product. The roadmap from here to a polished cross-platform tool (Mac and Windows desktop apps via Tauri or Electron, shared server-side state for collaboration, native mobile, full a11y, undo history, real test coverage) is months of engineering. But every step uses what's already here — the data/engine separation, the schema, the JSON-as-document model. Nothing gets thrown out.

## Pointers

- `shared/schema.md` — the data contract; sufficient to author a second work
- `engine.html` — the renderer; well-commented section by section
- `tools/validate.py` — what to run before pushing
