#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

volume_name="api-data"
force="false"

for arg in "$@"; do
  case "$arg" in
    --force | -f) force="true" ;;
  esac
done

project_name="${COMPOSE_PROJECT_NAME:-$(basename "$repo_root")}"

if [[ "$force" != "true" ]]; then
  printf 'This will stop the Docker Compose stack and delete the "%s" volume for project "%s".\n' "$volume_name" "$project_name"
  printf 'Stored API data, including /data/markr.db, will be removed. Continue? [y/N] '
  read -r answer || answer=""

  case "$answer" in
    y | Y | yes | YES) ;;
    *)
      printf 'Aborted.\n'
      exit 0
      ;;
  esac
fi

printf 'Stopping Docker Compose services...\n'
docker compose down --remove-orphans

volume_ids="$(docker volume ls \
  --quiet \
  --filter "label=com.docker.compose.project=$project_name" \
  --filter "label=com.docker.compose.volume=$volume_name")"

if [[ -z "$volume_ids" ]]; then
  fallback_volume="${project_name}_${volume_name}"

  if docker volume inspect "$fallback_volume" >/dev/null 2>&1; then
    volume_ids="$fallback_volume"
  fi
fi

if [[ -z "$volume_ids" ]]; then
  printf 'No Docker volume found for "%s" in project "%s". Nothing to clear.\n' "$volume_name" "$project_name"
  exit 0
fi

printf 'Deleting Docker volume(s):\n%s\n' "$volume_ids"
docker volume rm $volume_ids
printf 'Done. The API data volume will be recreated the next time you run docker compose up.\n'
