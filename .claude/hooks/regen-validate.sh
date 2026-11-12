#!/usr/bin/env bash
# Stop hook: regenerate library.json and validate examples.
# Exit 2 on failure so the agent is forced to read the output and fix it.
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Avoid an endless loop if the agent is already continuing from a previous block.
if [ "$(cat | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

out=$( { npm run build-index && npm run validate; } 2>&1 )
status=$?
if [ $status -ne 0 ]; then
  {
    echo "Regenerating library.json / validating examples FAILED. Fix the issues below:"
    echo "$out"
  } >&2
  exit 2
fi
exit 0
