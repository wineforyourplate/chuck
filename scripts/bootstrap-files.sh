#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lemma_cmd=(lemma "$@")

command -v jq >/dev/null 2>&1 || {
  echo "jq is required to bootstrap file contents." >&2
  exit 1
}

upload_file() {
  local relative_path="$1"
  local local_path="$repo_root/files/$relative_path"
  local remote_path="/$relative_path"
  local payload

  payload="$(jq -Rs --arg path "$remote_path" '{path:$path,content:.}' "$local_path")"
  "${lemma_cmd[@]}" functions run seed_file --data "$payload" >/dev/null
  echo "uploaded $remote_path"
}

for relative_path in \
  playbook/answer.md \
  playbook/curate.md \
  playbook/develop.md \
  playbook/save-and-route.md \
  playbook/voice.md \
  voices/voice_clear_direct.md \
  voices/voice_clear_operator.md \
  voices/voice_first_principles.md
do
  upload_file "$relative_path"
done

echo "Chuck's public playbooks and Developer Agent style templates are ready."
