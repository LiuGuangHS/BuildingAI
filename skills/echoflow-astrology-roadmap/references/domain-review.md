# Astrology Domain Review

Use this checklist for deterministic chart, Snapshot, transit, compatibility, fact/evidence, or Report V2 changes. Review the changed diff and direct contracts first; inspect wider code only when needed to prove a failure path.

## Input and time

- Birth date, local time, birth-time accuracy, latitude, longitude, and IANA timezone are normalized before hashing or calculation.
- Invalid zones, nonexistent DST times, and ambiguous repeated times have explicit behavior and tests.
- Unknown birth time produces a documented partial result; defaults do not silently become exact input.
- Decimal coordinates returned as strings or numbers normalize to the same bounded precision.

## Calculation

- UTC conversion, angle units, longitude direction, coordinate frame, and 0-360 normalization are explicit.
- Engine calls and transformations use documented APIs; sign, retrograde, ascendant, midheaven, house, and aspect calculations do not mix conventions.
- Zodiac system, house system, aspect set, orb rules, and algorithm constants are versioned.
- Ascendant and houses are absent when birth time or required location precision is unavailable.
- Golden fixtures cover UTC, Asia/Shanghai, a DST zone, date boundaries, both hemispheres, and unknown time with meaningful numeric tolerances.

## Snapshot and concurrency

- Input hash uses one canonical field order and normalization path.
- `(profileId, inputHash, engineVersion, ruleSetVersion)` remains idempotent under concurrent requests.
- External calculation is outside long transactions; pointer/status updates use short transactions, lock timeout, and stale-input/CAS checks where required.
- A late calculation cannot replace a newer profile input or terminal state.
- Historical Snapshots remain immutable; engine or rule changes create a new version.
- Failed snapshots expose stable public-safe codes while detailed operator errors remain restricted.

## Facts, reports, and AI

- Stable fact IDs and source paths point to facts present in the referenced Snapshot or report context.
- Fact confidence cannot exceed input quality; missing data and warnings reach Report V2 prompts.
- Reports bind the exact Snapshot, engine/rule/result versions, and generation-time transit context needed for replay.
- AI evidence references allowed fact IDs/source paths and rejects missing, cross-Snapshot, or fabricated evidence.
- AI summaries, feedback, and prior reports are not written back as astronomical or user-provided facts.
- Compatibility input ownership, temporary target retention, and partial-data degradation are explicit.

## Public, privacy, and product claims

- Web serializers omit `userId`, raw input, precise location when not required, internal errors, provider/model internals, billing diagnostics, and Console metadata.
- User-visible quality states distinguish complete, partial, stale, calculating, and failed without implying unavailable precision.
- Copy and UI do not present astrology as deterministic medical, legal, financial, or guaranteed future advice.

## Output

Report findings by severity with a tight path/line, concrete failure scenario, smallest fix, and runnable verification. If no finding exists, list files checked, residual numerical/fixture risk, and tests or external references still missing.
