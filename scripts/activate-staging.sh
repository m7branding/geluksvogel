#!/usr/bin/env bash
set -euo pipefail

webroot=${1:?Missing documentroot}
release_id=${2:?Missing release identifier}
hosting_domain=geluksvogel.bio
webroot=${webroot%/}
[[ "$release_id" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{6,99}$ ]] || exit 1
case "$webroot" in
  "/domains/$hosting_domain/public_html"|"/home/$(id -un)/domains/$hosting_domain/public_html") ;;
  *) echo 'Refusing activation outside the GeluksVogel documentroot' >&2; exit 1 ;;
esac
private_root="${webroot%/public_html}/geluksvogel-deploy"
release_path="$private_root/releases/$release_id"
backup_path="$private_root/backups/$release_id"

exec 9> "$private_root/.deploy.lock"
flock -w 120 9
test -d "$webroot"
test ! -L "$webroot"
test -f "$release_path/index.html"
test -f "$release_path/deployment.json"
test -f "$release_path/.htaccess"
test -f "$release_path/admin/index.html"

mkdir -p "$private_root/backups"
mkdir "$backup_path"
rsync -a "$webroot/" "$backup_path/"

# Retain hosting files and assets still referenced by a visitor's previous page.
if ! rsync -a --delay-updates --delete-delay \
    --exclude '/.well-known/' --exclude '/cgi-bin/' \
    --filter 'P /_astro/***' --filter 'P /assets/***' \
    "$release_path/" "$webroot/"; then
  echo 'Activation failed; restoring the previous website.' >&2
  rsync -a --delay-updates --delete-delay \
    --exclude '/.well-known/' --exclude '/cgi-bin/' \
    "$backup_path/" "$webroot/"
  exit 1
fi
echo "Previous GeluksVogel website preserved at $backup_path"
