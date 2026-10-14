# Self-hosted zrok relay (optional)

This piece is different from everything else in this project: it needs a
second machine (a small VPS, not the phone), a domain name you control, and
it touches a tool — zrok — that's mid-transition to a new major CLI version
as of this writing. Treat the commands below as a strong starting point,
not gospel. Where I'm not fully confident, I've said so and pointed at the
docs instead of guessing.

## What you need first

- A small VPS with a public IP and Docker + Docker Compose installed (any
  cheap VPS or a free-tier Oracle Cloud ARM instance works)
- A domain you control, with a wildcard DNS record pointing at that VPS's
  IP (e.g. `*.share.yourdomain.com` -> `<vps-ip>`)
- Ideally, a DNS provider with a Caddy or Traefik plugin, so the stack can
  issue itself a wildcard TLS certificate automatically

Why bother over zrok.io's hosted service: your own instance has no rate
limit beyond what this VPS can actually push. Why it's not a five-minute
job: it's a real multi-service deployment (an OpenZiti controller and
router, plus the zrok controller and frontend), not a single binary.

## On the VPS: `vps-setup.sh`

Pulls the official self-hosting compose project, walks you through the
domain/TLS config it needs (check exact `.env` variable names against
https://docs.zrok.io/docs/guides/self-hosting/docker/ at the time you run
this — they can shift between releases), brings the stack up, and creates
your admin account.

## On the phone: `phone-share.sh`

Enables your zrok environment against the instance you just stood up, and
does a quick ad-hoc public share of nginx on :8080 to prove it works.

## The one real gap

zrok's own changelog shows it renaming its binary to `zrok2` and retiring
the old `zrok reserve` / `zrok share reserved` persistent-sharing commands
in favor of a new namespace-based system. Which one you get when you
install today depends on timing, and I can't verify that from here. The
ad-hoc `zrok share public localhost:8080` command works either way for
testing — it just hands you a new URL every time you run it. For something
persistent that survives restarts, run `zrok --help` (or `zrok2 --help`)
after installing and look for whatever the current docs call the
reserved/namespace flow, then run that inside a tmux session instead.

## Remember

Whatever URL comes out of this is for demos and letting other people click
your shortened links — never point `load-test/redirects.js` at it. Load
tests still go straight over Tailscale to the phone.
