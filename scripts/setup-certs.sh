#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="$(git rev-parse --show-toplevel)/certs"

if [ -f "$CERT_DIR/localhost.pem" ]; then
  echo "Certs already exist at $CERT_DIR"
  exit 0
fi

if ! command -v mkcert &>/dev/null; then
  echo "mkcert not found. Install it first:"
  echo "  brew install mkcert    # macOS"
  echo "  sudo apt install mkcert  # Debian/Ubuntu"
  exit 1
fi

mkcert -install 2>/dev/null || true

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"
mkcert localhost 127.0.0.1 ::1

mv localhost+2.pem localhost.pem
mv localhost+2-key.pem localhost-key.pem

echo "Certs created at $CERT_DIR"
