#!/usr/bin/env bash
# Packages the skill into a distributable `.skill` archive (a plain zip of the
# skill payload) named after the version declared in SKILL.md. The agent-plugins
# marketplace sync unpacks this artifact into the plugin.
set -euo pipefail

VERSION=$(grep -m1 '^version:' SKILL.md | sed 's/version:[[:space:]]*//')
if [ -z "$VERSION" ]; then
  echo "error: no 'version:' front-matter found in SKILL.md" >&2
  exit 1
fi

OUT="pinmeto-web-presence-${VERSION}.skill"
rm -f ./*.skill

# Include only the skill payload. Never ship dev cruft, node_modules, or the
# previous archive.
# LICENSE ships because SKILL.md front matter points the reader at it.
PAYLOAD=(SKILL.md LICENSE)
[ -d references ] && PAYLOAD+=(references)
[ -d scripts ] && PAYLOAD+=(scripts)
[ -d assets ] && PAYLOAD+=(assets)

zip -rq "$OUT" "${PAYLOAD[@]}" \
  -x '*/.DS_Store' '*/node_modules/*' '*/__pycache__/*' '*.pyc' '*.skill'

echo "$OUT"
