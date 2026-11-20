# Editorial review list

Everything here needs the editor's eye before the apparatus can be called reviewed.
Nothing in the four work files has been checked against a book or a manuscript, with
one exception (the Dickinson page, below). The viewer says so on every page: each
attribution shows a `?` until its `verified` flag is set to `true`.

## 1. Found while rebuilding (most serious first)

**Dickinson: the facsimile was not the manuscript it was labelled as.** The image
shipped as `fascicle-6.jpg` and captioned "Fascicle 6, ca. 1859" does not carry
"Light laughs the breeze". It reads "Lie the meek members", then "Grand go the
Years", then, under a ruled line, the first three lines of "Springs - shake the
Sills". It is a later copy, probably the 1861 fascicle copy. In v5:

- the image is renamed `ms-1861.jpg` and belongs to a new witness **A**, which is
  now the source text, transcribed from the image (provisional: the image is
  720px wide, so check pointing and capitals against Franklin);
- Fascicle 6 stays as witness **F** with no image and the transcription removed;
- **"Lie" is no longer a conjecture.** The seed file said no witness supports it.
  It is in Dickinson's hand on the page the site itself shows. These three
  attestations (Lie, Grand go, Springs/Sills) are the only ones marked verified.
- To decide: which shelfmark belongs to which manuscript (`h11b–c` was attached to
  the image), the real identity of witness A, and the document behind the
  "seals" stanza (witness **D** is a placeholder).
- The reading text mixes states: "Sleep" (1859) with the capitals and dashes of
  the later copy and the 1861 second stanza. Decide what the reading text is.
- Whether the copy sent to Higginson reads "Sleep" or "Lie" is not recorded.

**Sonnet 116: the couplet crux was false and is removed.** It claimed the Quarto
has no comma after "proued"; the Quarto text in the same file has one. A sentence
in Malone's context repeating the claim is cut. The sonnet now has one crux.
Real candidates I did not seed, because they need a facsimile and the editions:
`worths`/`worth's` and `higth`/`height` in line 8, the colon after `doome`.
Whether Booth and Vendler print a full stop after "impediments" is unchecked.

**Sappho: several renderings credited to Carson do not match my recollection of
*If Not, Winter*.** From memory she has "sweet speaking" (file: "sweet-voicing"),
"even a moment" ("even briefly"), "tongue breaks" ("is broken") and "cold sweat
holds me" ("a cold sweat covers me"). My memory is not a source either; check the
book. Poochigian's context says the Penguin volume has "introductions by Carl
Lindahl", which looks wrong. All nineteen attributions are unverified.

**Rilke: every translator's rendering is unverified**, and the editor's notes quote
a line from each translation. Check each against the edition and add page numbers
(`"locus"`).

**Real scholars had invented arguments under their names.** Listed in the table
below. Where a name matched a real scholar the reasoning is kept as an unnamed
illustrative voice; where the "voice" was a translator or an edition, the witness
now attests the reading and the text survives as an unsigned editor's note. To
turn any of them into a published voice, set `"kind": "attested"` and give a
`citation`; the validator refuses an attested voice without one.

## 2. Decisions taken that you may want to reverse

- The edition statement in each file says the apparatus was machine-drafted and is
  unchecked. It is in your name; reword it as you see fit.
- Voices attach to readings only. Voices that praised a document rather than
  argued for a reading were dropped (table below).
- Variant "witnesses" that were really readings (Light laughs, the couplet texts)
  are gone; a witness is now always a document.
- Sappho: Voigt's siglum changed from S to V. Sonnet: Booth's from Bth to Bo.
- Reader data saved by the old viewer (`variorum.<id>.v2`) is not migrated: its
  endorsements hung on witness cards that no longer exist. The old keys are left
  untouched in the browser.
- Governance thresholds (3 to recognise, 5 to canonise) are no longer described
  in the interface, because without shared state they cannot happen. A reader's
  proposals are local, labelled as such, and exportable.

## 3. Removed or reassigned, item by item

| Work | What | Why |
|---|---|---|
| fr124 | voice "M. Stein · Wesleyan" on witness fascicle-6 | it praised a document rather than supporting a reading; voices now attach to readings only |
| fr124 | voice "T. Hassan · NYU" on witness fascicle-6 | it praised a document rather than supporting a reading; voices now attach to readings only |
| fr124 | voice "A. Okonkwo · King's College" on witness sue-letter | it praised a document rather than supporting a reading; voices now attach to readings only |
| fr124 | voice "D. Chen · Yale" on witness frostier-note | it praised a document rather than supporting a reading; voices now attach to readings only |
| fr124 | voice "Springfield Daily Republican" on Light laughs | a newspaper printing a stanza is an attestation, not an argument; now recorded as witness R attesting the reading |
| fr124 | voice "M. Stein · Wesleyan" on Sleep | its whole argument was that no witness supports “Lie”; the manuscript page reproduced on the site reads “Lie” |
| fr124 | voice "J. Park · Brown" on Lie | it rested on an argument attributed to Helen Vendler that the file gives no source for |
| sonnet-116 | crux “couplet” (Quarto pointing vs regularised) | it rested on the claim that the Quarto has no comma after “proued”; the Quarto text in the same file has the comma, so the two readings differed only in spelling. Removed, with its illustrative voice (R. Novak) and the two pseudo-witnesses that carried the couplet texts |
| sonnet-116 | voices “S. Booth · 1977”, “H. Vendler · 1997”, “E. Malone · 1790”, “The 1609 Quarto” | invented reasoning under real names (and a book cannot argue). The editions are now witnesses attesting the reading; the reasoning survives as an unsigned editorial note |
| sappho-31 | voice "M. L. West · Oxford" on witness voigt-1971 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "P. Kallias · Athens" on witness voigt-1971 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "G. Wills · Cambridge" on witness catullus-51 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "L. Tatum · Wake Forest" on witness catullus-51 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "C. Reed · Princeton" on witness wharton-1885 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "A. Stein · Iowa Writers' Workshop" on witness barnard-1958 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "D. Mendelsohn · Bard" on witness carson-2002 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "E. Vandiver · Whitman College" on witness carson-2002 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "R. Calame · Lausanne" on witness poochigian-2009 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "N. Krevans · Minnesota" on witness rayor-2014 | it praised a document rather than supporting a reading; voices now attach to readings only |
| sappho-31 | voice "F. Budelmann · Oxford" | name of a real scholar on invented reasoning; kept as an unnamed illustrative voice |
| sappho-31 | voice "L. Prauscello · Trinity Cambridge" | name of a real scholar on invented reasoning; kept as an unnamed illustrative voice |
| sappho-31 | voice "M. Henrichs · Harvard" | name of a real scholar on invented reasoning; kept as an unnamed illustrative voice |
| sappho-31 | voice "C. Calame · Lausanne" | name of a real scholar on invented reasoning; kept as an unnamed illustrative voice |
