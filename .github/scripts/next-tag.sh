#!/usr/bin/env bash
# Print the next release tag for a component, or nothing if it has no changes since its last tag.
#   usage: next-tag.sh <backend|frontend>
# Tags look like backend/v1.2.3. First release is v0.1.0. Bump rules for commits that touch the
# component's paths since the last tag: "!:" or "BREAKING CHANGE" -> major, "feat" -> minor,
# anything else -> patch (the default).
set -euo pipefail

component="${1:?component required}"
case "$component" in
  backend) paths=(api shared package.json package-lock.json docker/backend.Dockerfile) ;;
  frontend) paths=(web shared package.json package-lock.json docker/frontend.Dockerfile docker/nginx.conf docker/security-headers.conf) ;;
  *) echo "unknown component: $component" >&2; exit 2 ;;
esac

last="$(git tag -l "$component/v*" --sort=-v:refname | head -n1)"
if [ -z "$last" ]; then
  echo "$component/v0.1.0"
  exit 0
fi

if [ -z "$(git diff --name-only "$last" HEAD -- "${paths[@]}")" ]; then
  exit 0 # nothing changed for this component
fi

log="$(git log --format='%s%n%b' "$last"..HEAD -- "${paths[@]}")"
IFS=. read -r major minor patch <<<"${last#"$component"/v}"
if grep -qE '^[a-z]+(\([^)]*\))?!:|^BREAKING CHANGE' <<<"$log"; then
  major=$((major + 1)); minor=0; patch=0
elif grep -qE '^feat(\([^)]*\))?:' <<<"$log"; then
  minor=$((minor + 1)); patch=0
else
  patch=$((patch + 1))
fi
echo "$component/v$major.$minor.$patch"
