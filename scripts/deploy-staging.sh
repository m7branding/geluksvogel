#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_SSH_HOST:?Set the verified GeluksVogel SSH hostname}"
: "${DEPLOY_SSH_USER:?Set the GeluksVogel hosting user}"
: "${DEPLOY_WEBROOT:?Set the verified GeluksVogel documentroot}"
: "${DEPLOY_KEY_FILE:?Set the SSH private key file}"
: "${DEPLOY_KNOWN_HOSTS_FILE:?Set the pinned SSH known_hosts file}"
: "${DEPLOY_RELEASE_ID:?Set a unique commit/run release identifier}"
: "${GITHUB_SHA:?Set the full commit being deployed}"
ssh_port=${DEPLOY_SSH_PORT:-7685}
hosting_domain=geluksvogel.bio
DEPLOY_WEBROOT=${DEPLOY_WEBROOT%/}

# Restrict the upload to the agreed subdomain directory, never the agency site.
[[ "$DEPLOY_SSH_HOST" =~ ^web[0-9]+\.zxcs\.nl$ ]] || { echo 'Invalid SSH host' >&2; exit 1; }
[[ "$DEPLOY_SSH_USER" =~ ^u[0-9]+p[0-9]+$ ]] || { echo 'Invalid SSH user' >&2; exit 1; }
[[ "$ssh_port" =~ ^[0-9]{1,5}$ ]] || { echo 'Invalid SSH port' >&2; exit 1; }
[[ "$DEPLOY_RELEASE_ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{6,99}$ ]] || { echo 'Invalid release identifier' >&2; exit 1; }
case "$DEPLOY_WEBROOT" in
  "/domains/$hosting_domain/public_html"|"/home/$DEPLOY_SSH_USER/domains/$hosting_domain/public_html") ;;
  *) echo 'Refusing upload outside the GeluksVogel documentroot' >&2; exit 1 ;;
esac

# Refuse a local-CMS build, an unrelated repository or a different commit.
script_dir=$(cd "$(dirname "$0")" && pwd)
node "$script_dir/validate-staging.mjs"

ssh_args=(-p "$ssh_port" -i "$DEPLOY_KEY_FILE"
  -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$DEPLOY_KNOWN_HOSTS_FILE")
destination="$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST"

# This hosting hands out a short /domains path, while its shell only knows the
# full path under the home directory. Ask the server which of the two it has, and
# hold the answer to the same allowlist as the configured value.
DEPLOY_WEBROOT=$(ssh "${ssh_args[@]}" "$destination" "bash -s -- '$DEPLOY_WEBROOT'" <<'REMOTE'
set -eu
webroot=$1
if [ -d "$webroot" ]; then printf '%s\n' "$webroot"
elif [ -d "$HOME/${webroot#/}" ]; then printf '%s\n' "$HOME/${webroot#/}"
else echo "The documentroot $webroot does not exist on the server" >&2; exit 1; fi
REMOTE
)
case "$DEPLOY_WEBROOT" in
  "/domains/$hosting_domain/public_html"|"/home/$DEPLOY_SSH_USER/domains/$hosting_domain/public_html") ;;
  *) echo 'The server named a documentroot outside the GeluksVogel documentroot' >&2; exit 1 ;;
esac
echo "Publishing to $DEPLOY_WEBROOT"

private_root="${DEPLOY_WEBROOT%/public_html}/geluksvogel-deploy"
release_path="$private_root/releases/$DEPLOY_RELEASE_ID"

# Keep complete releases and backups outside every public_html directory.
ssh "${ssh_args[@]}" "$destination" "set -e; test \"\$(id -un)\" = '$DEPLOY_SSH_USER'; test -d '$DEPLOY_WEBROOT'; test ! -L '$DEPLOY_WEBROOT'; command -v rsync tar flock >/dev/null; umask 022; mkdir -p '$private_root/releases'; mkdir '$release_path'"
COPYFILE_DISABLE=1 tar -czf - -C dist . |
  ssh "${ssh_args[@]}" "$destination" "tar -xzf - -C '$release_path'"
ssh "${ssh_args[@]}" "$destination" "bash -s -- '$DEPLOY_WEBROOT' '$DEPLOY_RELEASE_ID'" < scripts/activate-staging.sh
# Confirm from the server itself that the whole build is in the documentroot.
built=$(find dist -type f | wc -l | tr -d ' ')
ssh "${ssh_args[@]}" "$destination" "bash -s -- '$DEPLOY_WEBROOT' '$built'" <<'REMOTE'
set -eu
webroot=$1
built=$2
found=$(find "$webroot" -type f ! -path '*/.well-known/*' ! -path '*/cgi-bin/*' | wc -l | tr -d ' ')
printf 'documentroot holds %s files; the build has %s\n' "$found" "$built"
test -f "$webroot/index.html"
test -f "$webroot/admin/index.html"
test -f "$webroot/.htaccess"
cat "$webroot/deployment.json"
test "$found" -ge "$built"
REMOTE
echo "Activated GeluksVogel release $DEPLOY_RELEASE_ID."
