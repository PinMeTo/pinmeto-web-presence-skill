#!/usr/bin/env bash
# One concurrent burst of every URL Stages 2-3 need.
#
#   scripts/fetch.sh --workdir DIR [--concurrency N] [--ua STRING]
#
# Reads the URL lists the scanning agent wrote into DIR (one `key url` pair per
# line, `#` comments and blank lines ignored):
#
#   fetch-list.txt            required - normal fetches, redirects followed
#   fetch-list-noredir.txt    optional - probed with --max-redirs 0
#   fetch-list-markdown.txt   optional - probed with `Accept: text/markdown`
#
# The two optional lists exist because following a redirect hides the answer.
# A `.well-known` path that 301s into the site's HTML 404 page looks like a
# 200 text/html once curl follows it, and reporting that as "the brand
# implements this standard" is a public claim about somebody's site that is
# simply false. Probe those paths without redirects and read the status
# yourself (SKILL.md rule 3).
#
# Per key, writes into DIR/fetch/:
#   <key>.h   response headers (last hop)
#   <key>.b   response body, byte for byte
#   <key>.m   http_code, url_effective, content_type, size_download, num_redirects,
#             tab-separated (a content type carries `; charset=`, so spaces are
#             not a safe delimiter)
#   <key>.err curl's stderr, when it had any
#
# Concurrency defaults to 3. Higher is tempting and backfires: at -P 8 against
# BunnyCDN, 9 of 26 connections came back reset, and a reset read as a fetch
# failure becomes a `warn` on a check that was actually fine. Resets are
# retried here regardless, but the retry costs more wall clock than the extra
# parallelism buys.
set -euo pipefail

WORKDIR=""
CONCURRENCY=3
UA='Mozilla/5.0 (compatible; PinMeTo-PresenceScan; +https://www.pinmeto.com)'

while [ $# -gt 0 ]; do
  case "$1" in
    --workdir) WORKDIR="${2:?--workdir needs a directory}"; shift 2 ;;
    --concurrency) CONCURRENCY="${2:?--concurrency needs a number}"; shift 2 ;;
    --ua) UA="${2:?--ua needs a string}"; shift 2 ;;
    -h|--help) sed -n '2,36p' "$0" | sed 's/^#\{1,\} \{0,1\}//'; exit 0 ;;
    *) echo "fetch.sh: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

if [ -z "$WORKDIR" ]; then
  echo "fetch.sh: --workdir is required" >&2
  exit 2
fi
if [ ! -d "$WORKDIR" ]; then
  echo "fetch.sh: no such workdir: $WORKDIR" >&2
  exit 2
fi

OUT="$WORKDIR/fetch"
mkdir -p "$OUT"

# Retries the transport failures a CDN hands out under concurrency: 7 (connect
# failed), 28 (timeout), 35 (TLS handshake), 52 (empty reply), 56 (recv error,
# which is where a connection reset lands). An HTTP error status is not a
# failure here - 404 is an answer, and several checks are about exactly which
# answer came back.
fetch_one() {
  local key="$1" url="$2"; shift 2
  local attempt rc
  for attempt in 1 2 3; do
    set +e
    curl -sS -m 60 -A "$UA" \
      -D "$OUT/$key.h" -o "$OUT/$key.b" \
      -w '%{http_code}\t%{url_effective}\t%{content_type}\t%{size_download}\t%{num_redirects}\n' \
      "$@" "$url" > "$OUT/$key.m" 2> "$OUT/$key.err"
    rc=$?
    set -e
    case "$rc" in
      0) [ -s "$OUT/$key.err" ] || rm -f "$OUT/$key.err"; return 0 ;;
      7|28|35|52|56) sleep "$attempt" ;;
      *) return 0 ;;  # a real curl error; the .m/.err pair records it
    esac
  done
  return 0
}
# Runs one list at CONCURRENCY in flight. Deliberately not xargs: each list
# needs its own curl flags appended *after* the URL, which xargs cannot do.
run_list_with() {
  local file="$1"; shift
  [ -f "$file" ] || return 0
  local extra=("$@")
  local key url
  local pids=()
  while read -r key url _; do
    case "$key" in ''|'#'*) continue ;; esac
    [ -n "${url:-}" ] || continue
    fetch_one "$key" "$url" "${extra[@]+"${extra[@]}"}" &
    pids+=($!)
    while [ "${#pids[@]}" -ge "$CONCURRENCY" ]; do
      wait "${pids[0]}" || true
      pids=("${pids[@]:1}")
    done
  done < "$file"
  for pid in "${pids[@]+"${pids[@]}"}"; do wait "$pid" || true; done
}

run_list_with "$WORKDIR/fetch-list.txt" -L
run_list_with "$WORKDIR/fetch-list-noredir.txt" --max-redirs 0
run_list_with "$WORKDIR/fetch-list-markdown.txt" -L -H 'Accept: text/markdown'

for meta in "$OUT"/*.m; do
  [ -e "$meta" ] || continue
  key=$(basename "$meta" .m)
  printf '%s: %s\n' "$key" "$(cat "$meta")"
done
