#!/bin/bash
# Run this ON THE PHONE, inside your Ubuntu chroot, after vps-setup.sh has
# given you an account token.
set -e

if ! command -v zrok &> /dev/null; then
  echo "zrok CLI isn't installed. Install it following the current guide at:"
  echo "  https://docs.zrok.io/docs/guides/install/linux/"
  echo "then re-run this script."
  exit 1
fi

read -p "Account token from vps-setup.sh: " ZROK_TOKEN
zrok enable "$ZROK_TOKEN"

echo ""
echo "Enabled. Testing an ad-hoc public share of nginx on :8080..."
echo "(Ctrl+C stops it — this URL changes every time you run this command.)"
zrok share public localhost:8080

# For a stable URL that survives restarts: zrok's persistent-sharing command
# has changed names during its v1 -> v2 transition (old: "zrok reserve" /
# "zrok share reserved"; v2 replaces this with namespaces). After installing,
# run `zrok --help` or `zrok2 --help` and look for "reserve" or "namespace"
# to find whichever one your installed version actually has, then run that
# inside a tmux session instead of the ad-hoc command above.
