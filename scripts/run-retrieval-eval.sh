#!/usr/bin/env bash
set -u

POD_ID="${1:-${LEMMA_POD_ID:-}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CASES_FILE="${BUNDLE_DIR}/evals/retrieval-cases.json"

if [[ -z "${POD_ID}" ]]; then
  echo "usage: LEMMA_SERVER=<saved-server> bash scripts/run-retrieval-eval.sh <pod-id>" >&2
  exit 2
fi

if ! command -v lemma >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "lemma and jq are required." >&2
  exit 2
fi

LEMMA_ARGS=(lemma)
if [[ -n "${LEMMA_SERVER:-}" ]]; then
  LEMMA_ARGS+=(--server "${LEMMA_SERVER}")
fi
LEMMA_ARGS+=(--pod "${POD_ID}")

total="$(jq 'length' "${CASES_FILE}")"
failures=0

for ((index = 0; index < total; index++)); do
  case_id="$(jq -r ".[$index].id" "${CASES_FILE}")"
  query="$(jq -r ".[$index].query" "${CASES_FILE}")"
  acceptance="$(jq -r ".[$index].acceptance" "${CASES_FILE}")"
  requires_url="$(jq -r ".[$index].requires_url // false" "${CASES_FILE}")"
  required_source="$(jq -r ".[$index].required_source // empty" "${CASES_FILE}")"
  prompt="[[CHUCK_APP_CITATIONS_V1]]
${query}"

  echo
  echo "[$((index + 1))/${total}] ${case_id}: ${query}"
  echo "Acceptance: ${acceptance}"

  if ! output="$("${LEMMA_ARGS[@]}" agents run chuck "${prompt}" 2>&1)"; then
    echo "${output}"
    echo "FAIL: Chuck could not complete the retrieval run."
    failures=$((failures + 1))
    continue
  fi

  echo "${output}"
  evidence_json="$(
    printf '%s\n' "${output}" |
      sed -n 's/.*<!--[[:space:]]*chuck-evidence[[:space:]]*:[[:space:]]*\(.*\)[[:space:]]*-->[[:space:]]*/\1/p' |
      tail -n 1
  )"

  if [[ -z "${evidence_json}" ]]; then
    echo "FAIL: missing app evidence envelope."
    failures=$((failures + 1))
    continue
  fi

  if ! printf '%s\n' "${evidence_json}" | jq -e '
    . as $items |
    type == "array" and
    length > 0 and length <= 4 and
    ([ $items[].note_id ] | unique | length) == ($items | length) and
    all(.[]; (
      (.note_id | type == "string" and length > 0) and
      (.reason | type == "string" and length > 0 and length <= 180) and
      (.source == "table" or .source == "file")
    ))
  ' >/dev/null 2>&1; then
    echo "FAIL: evidence must contain one to four unique note IDs, reasons, and table/file provenance."
    failures=$((failures + 1))
    continue
  fi

  if [[ -n "${required_source}" ]] &&
    ! printf '%s\n' "${evidence_json}" | jq -e --arg source "${required_source}" \
      'any(.[]; .source == $source)' >/dev/null 2>&1; then
    echo "FAIL: expected at least one ${required_source}-backed citation."
    failures=$((failures + 1))
    continue
  fi

  case_failed=0
  matched_url=0
  while IFS= read -r note_id; do
    if ! record_json="$("${LEMMA_ARGS[@]}" --json records get notes "${note_id}" 2>&1)"; then
      echo "FAIL: cited note ${note_id} is not readable for the current member."
      case_failed=1
      continue
    fi

    if ! printf '%s\n' "${record_json}" | jq -e --arg id "${note_id}" \
      '.. | objects | select((.id? // "") == $id)' >/dev/null 2>&1; then
      echo "FAIL: citation ${note_id} did not resolve to that exact notes row."
      case_failed=1
      continue
    fi

    if [[ "${requires_url}" == "true" ]]; then
      source_url="$(
        printf '%s\n' "${record_json}" |
          jq -r --arg id "${note_id}" \
            '[.. | objects | select((.id? // "") == $id) | .source_url? // empty][0] // empty'
      )"
      if [[ -n "${source_url}" && "${output}" == *"${source_url}"* ]]; then
        matched_url=1
      fi
    fi
  done < <(printf '%s\n' "${evidence_json}" | jq -r '.[].note_id')

  if [[ "${requires_url}" == "true" && "${matched_url}" -ne 1 ]]; then
    echo "FAIL: the answer did not include a cited note's saved source URL."
    case_failed=1
  fi

  if [[ "${case_failed}" -ne 0 ]]; then
    failures=$((failures + 1))
    continue
  fi

  echo "PASS: real evidence verified"
  printf '%s\n' "${evidence_json}" |
    jq -r '.[] | "  \(.note_id) [\(.source)] — \(.reason)"'
done

echo
if ((failures > 0)); then
  echo "${failures} retrieval contract check(s) failed."
  exit 1
fi
echo "All retrieval contract checks returned evidence envelopes."
