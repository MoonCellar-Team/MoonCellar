#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:?usage: generate-dkim.sh <domain> <selector> <directory>}"
SELECTOR="${2:?usage: generate-dkim.sh <domain> <selector> <directory>}"
DIRECTORY="${3:?usage: generate-dkim.sh <domain> <selector> <directory>}"

PRIVATE_KEY="$DIRECTORY/$DOMAIN.private"
PUBLIC_KEY="$DIRECTORY/$DOMAIN.public"

umask 077
mkdir -p "$DIRECTORY"

if [ -e "$PRIVATE_KEY" ]; then
  echo "$PRIVATE_KEY already exists. Publishing a second key under the same selector replaces the one every letter already signed with, so remove the old key only when its DNS record is replaced too." >&2
  exit 1
fi

openssl genrsa -out "$PRIVATE_KEY" 2048 2>/dev/null
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY" 2>/dev/null

chown 101:104 "$PRIVATE_KEY" 2>/dev/null \
  || echo "Could not chown the private key to opendkim (uid 101, gid 104): run this as root." >&2
chmod 640 "$PRIVATE_KEY"
chmod 644 "$PUBLIC_KEY"

PUBLIC_VALUE=$(openssl rsa -in "$PRIVATE_KEY" -pubout -outform DER 2>/dev/null | base64 -w0)

cat <<EOF
Add this record to the DNS zone of $DOMAIN:

$SELECTOR._domainkey.$DOMAIN. TXT "v=DKIM1; k=rsa; p=$PUBLIC_VALUE"

The private key stays on the host in $DIRECTORY and is never committed.
EOF
