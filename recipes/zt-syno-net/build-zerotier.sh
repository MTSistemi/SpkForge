#!/bin/sh
# Build a static zerotier-one from upstream ZeroTierOne, client only.
# Runs inside an Alpine container (musl, fully static), one per CPU family:
#   docker run --rm --platform linux/arm64 -v "$PWD:/w" alpine:3.20 \
#     sh /w/recipes/zt-syno-net/build-zerotier.sh 1.16.2 /w/out/armv8
#
# - ZT_STATIC=1: no dependency on the NAS's libc;
# - ZT_SSO_SUPPORTED=0: no Rust/OIDC component;
# - the controller lives in nonfree/ and is not built (MPL-2.0 code only);
# - no -march/-mtune: one x86_64 build runs on every Intel and AMD CPU
#   (AES-NI and friends are picked at run time by ZeroTier itself).
set -eu

VERSION="$1"
OUT="$2"

apk add --no-cache build-base linux-headers git file >/dev/null
git clone --quiet --depth 1 --branch "${VERSION}" https://github.com/zerotier/ZeroTierOne.git /src
cd /src
make -j"$(nproc)" ZT_STATIC=1 ZT_SSO_SUPPORTED=0 one
strip zerotier-one

file zerotier-one
if file zerotier-one | grep -q 'dynamically linked'; then
    echo "zerotier-one is not static" >&2
    exit 1
fi
./zerotier-one -v

mkdir -p "${OUT}"
cp zerotier-one "${OUT}/zerotier-one"
echo "${VERSION}" > "${OUT}/VERSION"
