#!/bin/bash

set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIRECTORY/../.." && pwd)"
OUTPUT_DIRECTORY="${OUTPUT_DIRECTORY:-$SCRIPT_DIRECTORY/dist}"

mapfile -t RECIPE_FILES <<EOF
apps/judge/src/languages/compile-java.sh
apps/judge/src/languages/compile-python.sh
infra/sandbox-rootfs/Dockerfile
infra/sandbox-rootfs/csc
infra/sandbox-rootfs/fsharpc
infra/sandbox-rootfs/mono
infra/sandbox-rootfs/smoke-test.sh
EOF

ROOTFS_ID="$({
    for file in "${RECIPE_FILES[@]}"; do
        printf '%s  %s\n' "$(git -C "$REPOSITORY_ROOT" hash-object "$file")" "$file"
    done
} | sha256sum | cut -d' ' -f1)"
ARCHIVE="rootfs-$ROOTFS_ID.tar.gz"
mkdir -p "$OUTPUT_DIRECTORY"
TEMPORARY_DIRECTORY="$(mktemp -d "$OUTPUT_DIRECTORY/.rootfs-build-XXXXXXXX")"
trap 'rm -rf "$TEMPORARY_DIRECTORY"' EXIT

docker buildx build \
    --platform linux/amd64 \
    --build-arg "ROOTFS_ID=$ROOTFS_ID" \
    --file "$SCRIPT_DIRECTORY/Dockerfile" \
    --output "type=tar,dest=$TEMPORARY_DIRECTORY/rootfs.tar" \
    "$REPOSITORY_ROOT"

gzip -n -9 "$TEMPORARY_DIRECTORY/rootfs.tar"
mv "$TEMPORARY_DIRECTORY/rootfs.tar.gz" "$OUTPUT_DIRECTORY/$ARCHIVE"

(
    cd "$OUTPUT_DIRECTORY"
    sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
)

printf 'ROOTFS_ID=%s\n' "$ROOTFS_ID"
printf 'ARCHIVE=%s\n' "$OUTPUT_DIRECTORY/$ARCHIVE"
