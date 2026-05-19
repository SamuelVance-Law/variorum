# Variorum schema 1.0

A *variorum* in this system is a JSON file at `works/<id>.json` that the engine fetches at boot. The engine is content-agnostic — every textual detail (the witnesses, the cruxes, the manuscript page, the reading copy) lives in the JSON. This document is the contract between a work file and the engine. Reading it should be sufficient to write a second work.

## The five entities

The model has five primary entities and one optional one. Most are stored as arrays at the top level of the work file.

A **Work** is the artifact under variorum treatment — a poem, a song, a translation, a sacred passage. Each variorum holds exactly one Work. The Work carries metadata: title, author, date period, kind.

A **Witness** is a textual record bearing on the Work. The Fascicle 6 manuscript is a witness. So is the Springfield Republican's 1862 printing, Sue's letter of objection, and any subsequent variant a scholar proposes. Witnesses share one ID space. One witness is designated the **primary witness** — for Dickinson, the Fascicle 6 holograph. The engine renders the primary witness specially (Layer 1, the manuscript page); everything else appears as orbital cards at Layer 3.

A **Crux** is a contested moment in the Work. It carries an *anchor* (where in the Work the contest lives) and one or more *Positions* (the contesting readings). A crux is a node in the apparatus; a position is a candidate at that node.

A **Position** is a candidate reading at a crux. It carries a label (the word or phrase being proposed), an optional `witnessId` linking it to a particular Witness, and a list of Endorsements with reasoning.

An **Endorsement** is a scholar's reasoned support for a Position (or for a Witness's reading as a whole). It carries an endorser identity, a date, and the reasoning. Endorsements are not bare votes — the system requires reasoning. The variorum holds reasoned readings.

A **Connection** is the optional sixth entity: a manuscript-historical link between two witnesses (this letter prompted that variant; this draft preceded that publication). Connections show as curved dashed lines on the canvas at Layer 3 and above. They are documentary, not interpretive.

## Anchors

The one place where medium-specificity lives is the **anchor** on a Crux. For a poem, an anchor is `{ stanzaId, lineIdx, originalWord }`. For a Bach invention it might be `{ measureNum, beat, voice }`. For a translation, `{ sourceLineIdx, targetLineIdx }`. The rest of the model (positions, endorsements, governance) is mode-agnostic.

Schema 1.0 only formally specifies the poem anchor shape, because Dickinson is the only work it has met. When the second work arrives, the anchor type set will expand and the engine will need a small dispatch to render anchors of new kinds. That is a foreseeable seam, deliberately not engineered yet.

The current poem-anchor shape:

```json
{
  "stanzaId": "stanza1",
  "lineIdx": 3,
  "originalWord": "Sleep"
}
```

`lineIdx` is zero-indexed within the stanza. `originalWord` is matched against the reading copy text with a word-boundary regex; it must match exactly one occurrence in the indicated line.

For seeded inline cruxes, the engine also accepts a `canvasPosition` (`{x, y}`) so Layer-4 satellites of endorsements know where to anchor in space.

For stanza-level cruxes (those that contest a whole stanza rather than a word), `location: "stanza"` is used and `anchor` is omitted — the engine looks at the reading copy's `asCrux` field to know where to render the stack.

## Top-level fields

A work file declares its schema version, identity, and metadata, then provides the data each rendering layer needs.

```json
{
  "schemaVersion": "1.0",
  "id": "fr124",
  "work": { ... },
  "primaryWitnessId": "fascicle-6",
  "manuscriptRendering": { ... },
  "readingCopy": { ... },
  "witnesses": [ ... ],
  "cruxes": [ ... ],
  "connections": [ ... ]
}
```

**`schemaVersion`** must match the engine's `SUPPORTED_SCHEMA` constant exactly. The engine refuses to render on mismatch; it does not attempt to coerce. Bumping the schema is a deliberate act with a migration path.

**`id`** is the work's stable identifier, used as the localStorage key namespace and as the URL slug (`?work=<id>` → `works/<id>.json`). Once a work has user state in the wild, the id must not change.

**`work`** carries display metadata: `title`, `shortTitle`, `author`, `kind`, `datePeriod`, optional `subtitle`. Used in the page title and About panel.

**`primaryWitnessId`** points to the witness rendered as the central manuscript at Layer 1. Must match an `id` in the `witnesses` array.

**`manuscriptRendering`** holds the data the engine uses to render the manuscript page at Layer 1 — see below.

**`readingCopy`** holds the typeset stanzas shown at Layer 2 — see below.

### `manuscriptRendering`

The manuscript card is the visual heart of Layer 1: a cream page with the poem in the author's hand, with line breaks preserved and crux marks where contested words live.

```json
"manuscriptRendering": {
  "lines": [
    { "text": "Safe in their Alabas-" },
    { "text": "ter Chambers -", "indent": true },
    { "text": "Light laughs the breeze", "gap": true },
    ...
  ],
  "cruxMarks": [
    { "cruxId": "verb", "top": 178, "left": 62, "title": "Sleep / Lie" }
  ],
  "caption": [
    { "text": "Houghton Library" },
    { "text": "MS Am 1118.3 · h11b–c", "mono": true },
    { "text": "Fascicle 6" },
    { "text": "ca. 1859" }
  ]
}
```

`lines` is the manuscript page transcribed line-for-line as the author broke them — including mid-word breaks. The `indent` flag indents the line (matching the manuscript's even-line indentation convention). The `gap` flag adds extra vertical space above the line (for stanza breaks). The engine renders these with serif italic to evoke handwriting; if a future work needs a different visual treatment, a `kind` field on `manuscriptRendering` could dispatch to alternate renderers.

`cruxMarks` are the tiny accent-coloured dots that appear on the manuscript page from Layer 2 onward, marking where contested words live. `top` and `left` are CSS pixels within the manuscript card. `cruxId` must reference an existing crux.

`caption` is the bibliographic line beneath the page. Parts with `mono: true` render in the monospace face; the engine inserts middot separators between parts.

### `readingCopy`

The reading copy at Layer 2 is the typeset clean version with the foregrounded reading at full opacity and alternatives ghosted behind. It carries its own canvas position (the engine doesn't compute it from the manuscript's position).

```json
"readingCopy": {
  "position": { "x": 220, "y": 0 },
  "stanzas": [
    {
      "id": "stanza1",
      "lines": [
        "Safe in their Alabaster Chambers —",
        "Untouched by Morning —",
        "And untouched by noon —",
        "{crux:verb} the meek members of the Resurrection,",
        "Rafter of Satin and Roof of Stone —"
      ]
    },
    {
      "id": "stanza2",
      "asCrux": "stanza2"
    }
  ]
}
```

A stanza has an `id` and is either a normal stanza (with `lines`) or a *stanza-level crux* (with `asCrux` pointing to a crux). A normal stanza's lines may contain `{crux:<cruxId>}` placeholders — these get replaced with the inline crux rendering (foregrounded reading + faded alternatives, with a tally beneath). Words in plain text become clickable for new-crux proposal.

A stanza marked `asCrux` is rendered entirely as the cycling stack of competing whole-stanza positions, with a tally beneath.

Stanza IDs must be stable — they appear in crux anchors.

### `witnesses`

Each witness is an object with an `id`, a `type`, and rendering metadata. The engine distinguishes three rendering modes by `type`:

A witness with `type: "manuscript"` is rendered as the central manuscript page (Layer 1) if it's also the `primaryWitnessId`. Manuscript-type witnesses use `manuscriptRendering` for their content (not their own `body` field).

A witness with `type: "variant"` is rendered as an orbital card at Layer 3 — a Variant card showing a competing reading of part or all of the Work.

A witness with `type: "source"` is rendered as an orbital card at Layer 3 — a Source card showing supporting documentation (letters, notes, publications) that bears on the textual history.

```json
{
  "id": "light-laughs",
  "type": "variant",
  "kind": "Variant",
  "sigla": "L",
  "title": "Light laughs the breeze",
  "subtitle": "Fascicle 6 reading",
  "date": "ca. 1859",
  "aboutPhrase": "the Light Laughs reading",
  "position": { "x": -280, "y": -740 },
  "stagger": 0,
  "body": "Light laughs the breeze\nIn her Castle above them —\n...",
  "multiline": true,
  "apparatus": {
    "context": "The second stanza as bound in Fascicle 6...",
    "endorsements": [
      { "endorser": "M. Stein · Wesleyan", "date": "Feb 2026", "reasoning": "..." }
    ]
  }
}
```

`sigla` is the single uppercase letter shown in the top-left of the card — `F`, `L`, `G`, etc. Sigla are conventionally derived from the witness type, but the schema does not enforce uniqueness; the editor's discretion governs.

`aboutPhrase` is the human-language descriptor used in the About panel's sigla list — e.g. *the Fascicle 6 manuscript*, *the Republican publication*. The engine composes the list automatically.

`position` is the canvas position in pixels — Layer 3 places cards in fixed orbital positions around the manuscript at center. Cards drift outward as more accumulate; the author chooses positions to compose a visual argument (Sue's letter at the top-right; the cosmic *Grand go* at upper-right; the cold *Springs — shake the Sills* at lower-left). The engine respects these positions exactly.

`stagger` (0–7) controls the fade-in delay when transitioning to Layer 3, in steps of 30ms. Useful for choreographing the moment the apparatus blooms.

`body` is the text shown on the card. `multiline: true` preserves newlines; `quoted: true` adds the italic + left-rule quote treatment.

`apparatus.context` is the editor's prose context for this witness — what it is, what it argues, why it matters. Shown when the card is engaged.

`apparatus.endorsements` is an array of editorial endorsements. Each carries `endorser` (a scholarly identity), `date`, and `reasoning`. The reasoning is the substantive part.

### `cruxes`

A crux has an `id`, a `label`, a `location` (`inline` for word-level, `stanza` for stanza-level), and `positions`. Inline cruxes also need an `anchor` (or, for seeded cruxes, the engine will derive it from the reading copy's `{crux:id}` placeholder). Seeded inline cruxes typically also carry a `canvasPosition` so Layer-4 satellites have a canvas point to orbit.

```json
{
  "id": "verb",
  "label": "Stanza 1, line 4",
  "location": "inline",
  "canvasPosition": { "x": -940, "y": -540 },
  "positions": [
    {
      "id": "sleep",
      "label": "Sleep",
      "foregrounded": true,
      "endorsements": [ ... ]
    },
    {
      "id": "lie",
      "label": "Lie",
      "foregrounded": false,
      "endorsements": [ ... ]
    }
  ]
}
```

A position has its own `id` (used for endorsement satellites and for color assignment), `label` (the contesting word or phrase), `foregrounded` (exactly one position per crux should be foregrounded — that's the reading shown at full opacity), and either inline `endorsements` (for word-level positions) or a `witnessId` (for stanza-level positions, where the position *is* a whole-stanza witness like *Grand go* or *Springs — shake the Sills*).

When a position carries a `witnessId`, the engine pulls endorsements from that witness's apparatus rather than from the position. This avoids duplicating endorsements between position and witness.

Positions get per-position colors assigned at boot from a small muted palette. Colors stay stable across sessions (assigned in the order positions appear in the work file). The position color appears as a thin left-rule on the corresponding cards and satellites, and as the stroke colour on connection lines.

### `connections`

```json
{ "from": "fascicle-6", "to": "light-laughs" }
```

Connections are directed but the rendering treats them as undirected (curved dashed lines). `from` and `to` must both reference real witness IDs. Connections are optional; if you don't provide any, Layer 3 just shows cards floating without lineage lines.

## Governance state machine for cruxes

A crux carries an optional `state` field:

- **`canonical`** (or omitted) — the editor-defined cruxes that always render. The seeded cruxes are canonical.
- **`recognized`** — community-promoted but not yet full canonical. Renders in italic + faded with a *pending* badge in the inline reading.
- **`proposed`** — proposed by a single reader. Only visible in that reader's Personal view; suppressed from Canonical.

The promotion thresholds (currently three readers for *recognized*, five for *canonical*) live in the engine, not the schema. A future schema version may move them per-work; for now they are platform defaults.

User-proposed cruxes also carry `proposedBy` (the proposer's identity). User-added stanza-level positions carry `createdBy` on their witness. Both are how the engine knows which user-added content to show a "remove" affordance on.

## ID stability

Every `id` in a work file is load-bearing — localStorage state references them. Once a work has been deployed and users have endorsements stored locally, the following IDs must never change:

- The work's top-level `id`
- All `witnesses[*].id`
- All `cruxes[*].id`
- All `cruxes[*].positions[*].id`
- All stanza IDs in `readingCopy.stanzas`

You can rename labels, retouch prose, even reposition cards. You cannot change the IDs without invalidating user state.

The engine bumps its `STORAGE_VERSION` constant when storage shape changes. Currently `v2`. Bumping the storage version is one option when ID stability has to be broken; the cost is losing existing user state.

## Authoring a new work

The practical workflow:

1. Pick a stable `id` (lowercase, short, won't change). Conventionally the work's bibliographic catalogue number — `fr124` for Franklin 124. The file lives at `works/<id>.json`.
2. Fill in `work` metadata and pick a `primaryWitnessId`.
3. Transcribe the manuscript page into `manuscriptRendering.lines`. Get the line breaks right — they are part of the textual record.
4. Write the reading copy into `readingCopy.stanzas`. Mark word-level cruxes with `{crux:<id>}` placeholders. Mark stanza-level cruxes with `asCrux`.
5. Enumerate the witnesses — the primary manuscript, then variants, then sources. Place them on the canvas to compose a visual argument; orbit the manuscript at distances proportional to their conceptual distance.
6. Define the cruxes. For each, list the positions in the order you want them assigned colours. Mark one position as `foregrounded`.
7. Add connections as a documentary trace of the manuscript history.
8. Validate the file before pushing:
   ```bash
   python3 tools/validate.py works/<id>.json
   ```
   The validator catches missing required fields, broken references, duplicate ids, and structural issues. The engine runs the same referential checks at boot and shows precise errors in the load screen if anything is wrong, but catching them before deploy is faster.

The fastest way to start a second work is to copy `works/_template.json` — a valid skeleton with placeholder content — to `works/<your-id>.json` and replace the placeholders piece by piece. The schema is small enough that a competent author can write a new variorum in an afternoon if the underlying scholarship is in hand.

## What schema 1.0 doesn't yet specify

A short list of things deliberately left for later, in case you bump into them:

- **Multiple anchor types.** Only the poem anchor is formalised. The second non-text work will require a small expansion.
- **Image-based manuscript rendering.** The current manuscript layer transcribes text. A facsimile-image renderer would be a natural addition for visual works (and for high-fidelity manuscript reproduction).
- **Per-work governance thresholds.** Currently the engine hardcodes 3-for-recognized, 5-for-canonical. Per-work thresholds would let editorial communities calibrate.
- **Shared (server-side) endorsement state.** Currently all user state is per-browser via localStorage. A real platform needs a back-end. The schema is designed not to depend on this — endorsements can be merged from any source — but the engine is.
- **Comments on endorsements, threading, retraction histories.** The current endorsement model is flat. A scholar can withdraw their own endorsement but cannot reply to another's, and the system keeps no audit trail. These will matter when real scholars use it.

These are the seams a second demo will press on. Press them gently.
