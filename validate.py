#!/usr/bin/env python3
"""
Variorum work-file validator.

Checks a works/<id>.json file against the schema 1.0 contract. Catches
the kind of typos and broken references that would silently half-break
the engine. Run before pushing a new work file.

Usage:
    python3 tools/validate.py works/fr124.json
    python3 tools/validate.py works/*.json

Exits with non-zero if any errors are found, so it can guard a deploy.
"""

import json
import re
import sys
from pathlib import Path

SUPPORTED_SCHEMA = "1.0"
PLACEHOLDER_RE = re.compile(r"\{crux:([^}]+)\}")


def validate(data):
    """Returns a list of error strings. Empty list means valid."""
    errors = []

    # ---- Top-level required fields ----
    for field in ("schemaVersion", "id", "work", "primaryWitnessId",
                  "witnesses", "cruxes"):
        if field not in data:
            errors.append(f'Missing required top-level field: "{field}"')

    if "schemaVersion" in data and data["schemaVersion"] != SUPPORTED_SCHEMA:
        errors.append(
            f'schemaVersion "{data["schemaVersion"]}" does not match '
            f'supported version "{SUPPORTED_SCHEMA}"'
        )

    # If we're missing critical structures, no point continuing
    if not isinstance(data.get("witnesses"), list):
        errors.append("witnesses must be an array")
        return errors
    if not isinstance(data.get("cruxes"), list):
        errors.append("cruxes must be an array")
        return errors

    # ---- Witness IDs ----
    witness_ids = set()
    for i, w in enumerate(data["witnesses"]):
        wid = w.get("id")
        if not wid:
            errors.append(f"witnesses[{i}] is missing an id")
            continue
        if wid in witness_ids:
            errors.append(f'Duplicate witness id: "{wid}"')
        witness_ids.add(wid)
        if "position" not in w:
            errors.append(f'witnesses "{wid}" is missing a position {{x, y}}')
        elif not isinstance(w["position"], dict) or "x" not in w["position"] or "y" not in w["position"]:
            errors.append(f'witnesses "{wid}".position must be {{x, y}}')

    # ---- Crux IDs and positions ----
    crux_ids = set()
    for i, c in enumerate(data["cruxes"]):
        cid = c.get("id")
        if not cid:
            errors.append(f"cruxes[{i}] is missing an id")
            continue
        if cid in crux_ids:
            errors.append(f'Duplicate crux id: "{cid}"')
        crux_ids.add(cid)

        if "location" not in c:
            errors.append(f'cruxes "{cid}" is missing location (inline | stanza)')
        elif c["location"] not in ("inline", "stanza"):
            errors.append(f'cruxes "{cid}".location must be "inline" or "stanza"')

        positions = c.get("positions") or []
        if not positions:
            errors.append(f'cruxes "{cid}" has no positions')
        position_ids = set()
        foregrounded_count = 0
        for pi, p in enumerate(positions):
            pid = p.get("id")
            if not pid:
                errors.append(f'cruxes "{cid}".positions[{pi}] is missing an id')
                continue
            if pid in position_ids:
                errors.append(f'Duplicate position id "{pid}" within crux "{cid}"')
            position_ids.add(pid)
            if p.get("foregrounded"):
                foregrounded_count += 1
            if "witnessId" in p and p["witnessId"] not in witness_ids:
                errors.append(
                    f'cruxes "{cid}".positions[{pi}].witnessId "{p["witnessId"]}" '
                    f'is not a known witness'
                )
        if positions and foregrounded_count == 0:
            errors.append(f'cruxes "{cid}" has no foregrounded position')
        if foregrounded_count > 1:
            errors.append(
                f'cruxes "{cid}" has {foregrounded_count} foregrounded positions '
                f'(exactly one expected)'
            )

    # ---- primaryWitnessId ----
    pwid = data.get("primaryWitnessId")
    if pwid and pwid not in witness_ids:
        errors.append(f'primaryWitnessId "{pwid}" is not a known witness')

    # ---- Connections ----
    for i, c in enumerate(data.get("connections") or []):
        if c.get("from") not in witness_ids:
            errors.append(f'connections[{i}].from "{c.get("from")}" is not a known witness')
        if c.get("to") not in witness_ids:
            errors.append(f'connections[{i}].to "{c.get("to")}" is not a known witness')

    # ---- manuscriptRendering.cruxMarks ----
    mr = data.get("manuscriptRendering") or {}
    for i, m in enumerate(mr.get("cruxMarks") or []):
        if m.get("cruxId") not in crux_ids:
            errors.append(
                f'manuscriptRendering.cruxMarks[{i}].cruxId "{m.get("cruxId")}" '
                f'is not a known crux'
            )

    # ---- readingCopy ----
    rc = data.get("readingCopy") or {}
    stanza_ids = set()
    for si, stanza in enumerate(rc.get("stanzas") or []):
        sid = stanza.get("id")
        if not sid:
            errors.append(f"readingCopy.stanzas[{si}] is missing an id")
        elif sid in stanza_ids:
            errors.append(f'Duplicate stanza id: "{sid}"')
        stanza_ids.add(sid)

        if "asCrux" in stanza:
            if stanza["asCrux"] not in crux_ids:
                errors.append(
                    f'readingCopy.stanzas[{si}].asCrux "{stanza["asCrux"]}" '
                    f'is not a known crux'
                )
        elif "lines" in stanza:
            for li, line in enumerate(stanza["lines"]):
                for match in PLACEHOLDER_RE.finditer(line):
                    if match.group(1) not in crux_ids:
                        errors.append(
                            f"readingCopy.stanzas[{si}].lines[{li}] references "
                            f'unknown crux "{match.group(1)}"'
                        )
        else:
            errors.append(
                f"readingCopy.stanzas[{si}] must have either 'lines' or 'asCrux'"
            )

    return errors


def main(argv):
    if len(argv) < 2:
        print("Usage: validate.py <work.json> [<work.json> ...]")
        return 2

    total_errors = 0
    for path_str in argv[1:]:
        path = Path(path_str)
        if not path.exists():
            print(f"  ✗  {path}: file not found")
            total_errors += 1
            continue
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            print(f"  ✗  {path}: JSON parse error — {e}")
            total_errors += 1
            continue

        errors = validate(data)
        if not errors:
            title = data.get("work", {}).get("title", "(no title)")
            wid = data.get("id", "(no id)")
            print(f"  ✓  {path}  →  {wid}: {title}")
        else:
            print(f"  ✗  {path}: {len(errors)} error{'s' if len(errors) != 1 else ''}")
            for e in errors:
                print(f"       · {e}")
            total_errors += len(errors)

    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
