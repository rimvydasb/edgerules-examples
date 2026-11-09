#!/usr/bin/env bash
# Writes library.json, the repository index that the Examples Library loads first.
#
#   tooling/build-index.sh                 write library.json from the working tree and the history of HEAD
#   tooling/build-index.sh --check         write nothing; exit 1 when library.json differs from the result
#   tooling/build-index.sh --out <file>    write the index to <file>
#
# Needs bash 3.2+, git and jq 1.6+. The history must be complete (CI: fetch-depth 0).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

mode=write
out=library.json
while [ $# -gt 0 ]; do
  case "$1" in
    --check) mode=check ;;
    --out) shift; out="${1:?--out needs a file}"; mode=out ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }
head_sha="$(git rev-parse HEAD 2>/dev/null || true)"

entries="$(mktemp)"
trap 'rm -f "$entries" "$entries.new"' EXIT
: > "$entries"

find examples -mindepth 3 -maxdepth 3 -name edgerules.project.json | sort | while read -r manifest; do
  dir="$(dirname "$manifest")"
  jq -e . "$manifest" >/dev/null 2>&1 || { echo "cannot parse $manifest" >&2; exit 1; }
  id="$(basename "$dir")"

  tests=0
  for t in $(jq -r '(.tests // [])[]' "$manifest"); do
    tests=$((tests + $(jq '.cases | length' "$dir/$t")))
  done
  lines="$(wc -l < "$dir/$(jq -r '.model.source' "$manifest")" | tr -d ' ')"

  # versions: newest first-parent commit per model.version, newest version first
  versions='[]'
  if [ -n "$head_sha" ]; then
    while read -r sha date; do
      [ -n "$sha" ] || continue
      v="$(git show "$sha:$manifest" 2>/dev/null | jq -r '.model.version // empty' 2>/dev/null || true)"
      [ -n "$v" ] || continue
      versions="$(jq -c --arg v "$v" --arg ref "$sha" --arg d "$date" \
        'if any(.[]; .version == $v) then . else . + [{version: $v, ref: $ref, released: $d}] end' <<< "$versions")"
    done < <(git log --first-parent --format='%H %cs' -- "$dir")
  fi
  current="$(jq -r '.model.version' "$manifest")"
  if [ "$(jq --arg v "$current" 'any(.[]; .version == $v)' <<< "$versions")" != true ] \
     || ! git diff --quiet HEAD -- "$dir" 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard -- "$dir")" ]; then
    echo "warning: $dir has uncommitted changes; version $current has no ref" >&2
    versions="$(jq -c --arg v "$current" '[.[] | select(.version != $v)] | [{version: $v}] + .' <<< "$versions")"
  fi

  jq -c --arg id "$id" --arg path "$dir" --argjson tests "$tests" --argjson lines "$lines" --argjson versions "$versions" '{
    id: $id, path: $path, name: .name, description: .description,
    industry: .example.industry, level: .example.level, features: .example.features,
    tags: (.tags // []), engine: .example.engine,
    thumbnail: .example.thumbnail, requires: (.example.requires // []),
    stats: {tests: $tests, lines: $lines}, versions: $versions
  } | with_entries(select(.value != null))' "$manifest" >> "$entries"
done

jq --indent 2 -n -S --arg gen "$head_sha" \
  --slurpfile industries industries.json --slurpfile featured featured.json --slurpfile examples "$entries" '
  {schemaVersion: 1, generatedFrom: $gen, industries: $industries[0], featured: $featured[0],
   examples: ($examples | sort_by(.id))}' > "$entries.new"
# keep the documented key order of the top level
jq --indent 2 '{schemaVersion, generatedFrom, industries, featured, examples}' "$entries.new" > "$entries"

case "$mode" in
  check) diff -q "$entries" library.json >/dev/null || { echo "library.json is out of date: run tooling/build-index.sh" >&2; exit 1; } ;;
  *) cp "$entries" "$out"; echo "wrote $out" ;;
esac
