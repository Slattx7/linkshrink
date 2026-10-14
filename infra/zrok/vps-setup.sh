#!/bin/bash
# Run this on your VPS — NOT the phone. Needs Docker + Docker Compose, and a
# domain with a wildcard DNS record already pointing at this machine's IP.
set -e

WORKDIR="$HOME/zrok-instance"

echo "Fetching the official zrok self-hosting compose project into $WORKDIR..."
curl https://get.openziti.io/zrok-instance/fetch.bash | bash -s "$WORKDIR"
cd "$WORKDIR"

cat <<'EOF'

Now open .env in this directory and set your DNS zone and ports. If you
want real public TLS (you do), rename compose.caddy.yml to
compose.override.yml and configure a Caddy DNS plugin matching your DNS
provider so it can issue a wildcard cert automatically. Exact variable
names are documented at:
  https://docs.zrok.io/docs/guides/self-hosting/docker/

EOF
read -p "Press enter once .env and any compose override look right..."

docker compose up --build --detach

echo "Waiting for the controller to finish starting..."
sleep 10

echo ""
read -p "Admin email for your zrok account: " ZROK_ADMIN_EMAIL
read -s -p "Admin password: " ZROK_ADMIN_PASSWORD
echo ""

docker compose exec zrok-controller zrok admin create account "$ZROK_ADMIN_EMAIL" "$ZROK_ADMIN_PASSWORD"

echo ""
echo "Save the token printed above — you'll paste it into phone-share.sh."
