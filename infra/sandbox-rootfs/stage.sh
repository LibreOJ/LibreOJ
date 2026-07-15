#!/bin/bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    echo "stage.sh must run as root" >&2
    exit 1
fi

ARCHIVE="${ARCHIVE:?Set ARCHIVE to an absolute rootfs archive path}"
CHECKSUM="${CHECKSUM:?Set CHECKSUM to an absolute SHA-256 file path}"
DESTINATION_PARENT="${DESTINATION_PARENT:?Set DESTINATION_PARENT to an absolute staging parent}"

for path in "$ARCHIVE" "$CHECKSUM" "$DESTINATION_PARENT"; do
    if [[ "$path" != /* ]]; then
        echo "Paths must be absolute: $path" >&2
        exit 1
    fi
done

ARCHIVE="$(realpath "$ARCHIVE")"
CHECKSUM="$(realpath "$CHECKSUM")"
DESTINATION_PARENT="$(realpath "$DESTINATION_PARENT")"
ARCHIVE_BASENAME="$(basename "$ARCHIVE")"

if [[ ! "$ARCHIVE_BASENAME" =~ ^rootfs-([0-9a-f]{64})\.tar\.gz$ ]]; then
    echo "Invalid archive name: $ARCHIVE_BASENAME" >&2
    exit 1
fi
ROOTFS_ID="${BASH_REMATCH[1]}"

mapfile -t CHECKSUM_LINES < "$CHECKSUM"
if [[ "${#CHECKSUM_LINES[@]}" -ne 1 ]] ||
   [[ ! "${CHECKSUM_LINES[0]}" =~ ^([0-9a-f]{64})\ \ ([^/]+)$ ]] ||
   [[ "${BASH_REMATCH[2]}" != "$ARCHIVE_BASENAME" ]]; then
    echo "Checksum must contain exactly one entry for $ARCHIVE_BASENAME" >&2
    exit 1
fi
EXPECTED_SHA256="${BASH_REMATCH[1]}"
ACTUAL_SHA256="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
    echo "Checksum mismatch for $ARCHIVE" >&2
    exit 1
fi

TEMPORARY_DIRECTORY="$(mktemp -d "$DESTINATION_PARENT/.rootfs-staging-XXXXXXXX")"
mounted=()

unmount_all() {
    local failed=0
    for ((index=${#mounted[@]} - 1; index >= 0; index--)); do
        if ! umount -R "${mounted[index]}"; then
            failed=1
        fi
    done
    mounted=()
    if findmnt -rn -o TARGET | awk -v root="$TEMPORARY_DIRECTORY" '$0 == root || index($0, root "/") == 1 { found = 1 } END { exit !found }'; then
        failed=1
    fi
    return "$failed"
}

cleanup() {
    local status="$?"
    trap - EXIT
    if ! unmount_all; then
        echo "Mounts remain under $TEMPORARY_DIRECTORY; refusing to delete it" >&2
        exit 1
    fi
    rm -rf "$TEMPORARY_DIRECTORY"
    exit "$status"
}
trap cleanup EXIT

tar -xzf "$ARCHIVE" --numeric-owner -C "$TEMPORARY_DIRECTORY"

if [[ "$(<"$TEMPORARY_DIRECTORY/etc/libreoj-rootfs-id")" != "$ROOTFS_ID" ]]; then
    echo "Embedded rootfs ID does not match $ARCHIVE_BASENAME" >&2
    exit 1
fi
for directory in proc dev usr/local/libexec; do
    if [[ ! -d "$TEMPORARY_DIRECTORY/$directory" ]]; then
        echo "Missing directory in rootfs: /$directory" >&2
        exit 1
    fi
done

mount -t proc proc "$TEMPORARY_DIRECTORY/proc"
mounted+=("$TEMPORARY_DIRECTORY/proc")

declare -A DEVICES=(
    [full]=1:7:666
    [null]=1:3:666
    [random]=1:8:666
    [urandom]=1:9:666
    [zero]=1:5:666
)
for device in "${!DEVICES[@]}"; do
    path="$TEMPORARY_DIRECTORY/dev/$device"
    if [[ ! -c "$path" ]] || [[ "$(stat -c '%t:%T:%a' "$path")" != "${DEVICES[$device]}" ]]; then
        echo "Invalid device in rootfs: /dev/$device" >&2
        exit 1
    fi
done

declare -A DEVICE_LINKS=(
    [fd]=/proc/self/fd
    [stderr]=/proc/self/fd/2
    [stdin]=/proc/self/fd/0
    [stdout]=/proc/self/fd/1
)
for link in "${!DEVICE_LINKS[@]}"; do
    path="$TEMPORARY_DIRECTORY/dev/$link"
    if [[ ! -L "$path" ]] || [[ "$(readlink "$path")" != "${DEVICE_LINKS[$link]}" ]]; then
        echo "Invalid device link in rootfs: /dev/$link" >&2
        exit 1
    fi
done

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
declare -A VALIDATION_FILES=(
    [libreoj-rootfs-smoke-test]="$REPOSITORY_ROOT/infra/sandbox-rootfs/smoke-test.sh"
    [compile-java.sh]="$REPOSITORY_ROOT/apps/judge/src/languages/compile-java.sh"
    [compile-python.sh]="$REPOSITORY_ROOT/apps/judge/src/languages/compile-python.sh"
)
for filename in "${!VALIDATION_FILES[@]}"; do
    target="$TEMPORARY_DIRECTORY/usr/local/libexec/$filename"
    touch "$target"
    mount --bind "${VALIDATION_FILES[$filename]}" "$target"
    mount -o remount,bind,ro "$target"
    mounted+=("$target")
done

chroot "$TEMPORARY_DIRECTORY" /bin/bash /usr/local/libexec/libreoj-rootfs-smoke-test stage

if ! unmount_all; then
    echo "Unable to unmount validation filesystems under $TEMPORARY_DIRECTORY" >&2
    exit 1
fi
for filename in "${!VALIDATION_FILES[@]}"; do
    rm "$TEMPORARY_DIRECTORY/usr/local/libexec/$filename"
done

if [[ "$(stat -c %u "$TEMPORARY_DIRECTORY")" -ne 0 ]] ||
   [[ "$(stat -c %g "$TEMPORARY_DIRECTORY")" -ne 0 ]]; then
    echo "Rootfs root must be owned by root" >&2
    exit 1
fi
if [[ "$(chroot "$TEMPORARY_DIRECTORY" id -u sandbox)" -ne 999 ]]; then
    echo "Sandbox UID must be 999" >&2
    exit 1
fi

DESTINATION="$DESTINATION_PARENT/rootfs-$ROOTFS_ID"
if [[ -e "$DESTINATION" ]]; then
    echo "Destination already exists: $DESTINATION" >&2
    exit 1
fi

chmod 0755 "$TEMPORARY_DIRECTORY"
mv "$TEMPORARY_DIRECTORY" "$DESTINATION"
trap - EXIT

printf 'ROOTFS_ID=%s\n' "$ROOTFS_ID"
printf 'STAGED_ROOTFS=%s\n' "$DESTINATION"
