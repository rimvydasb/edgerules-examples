#!/usr/bin/env bash
# Validates the examples: schema, format, engine link, tests, references, README, metadata, version, size, secrets.
#   tooling/validate.sh [--base <git-ref>] [example-id ...]
# Needs `npm ci` first (edgerules-react, @edgerules/node, ajv, highs, prettier).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -d node_modules/edgerules-react ] || { echo "run npm ci first" >&2; exit 2; }
exec node tooling/validate.mjs "$@"
