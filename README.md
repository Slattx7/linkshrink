# linkshrink — v2: sharded, cached, replicated, load balanced

What changed since step 1: one Postgres instance became 2 shards (each a
primary + streaming read replica), Valkey now caches redirects and rate-
limits link creation, and nginx load balances across 2 app instances.

## Setup (inside your Ubuntu chroot, as root)

```
chmod +x infra/*.sh
./infra/provision.sh
```

This installs Postgres, Valkey, nginx, Node, and tmux; provisions the 4
Postgres clusters (2 primaries, 2 replicas — see `infra/setup-shards.sh` for
exactly what it does); and wires up nginx. Check `pg_lsclusters` afterward —
you should see 4 clusters, all "online". Valkey starts itself on install;
confirm with `systemctl status valkey-server`.

Then:

```
cp .env.example .env   # edit PGPASSWORD to match what setup-shards.sh used
npm install
./infra/start-all.sh
```

## Test it end to end, over Tailscale from your laptop

```
curl -X POST http://<phone-tailscale-ip>:8080/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

The response now says which shard the link landed on:

```json
{ "short_code": "aB3xY9", "shard": 1, "short_url": "...", "long_url": "..." }
```

Hit the `short_url` a few times, then:

```
curl http://<phone-tailscale-ip>:8080/api/stats/<code>
```

`click_count` should be climbing. The first hit is a cache miss (reads the
replica); everything after is served from Valkey until the 1-hour TTL expires.

## Load testing

`load-test/redirects.js` is a k6 script that ramps traffic against the
redirect endpoint — the one your caching and replicas are actually built
for. Install k6 on your laptop, then run it pointed at your phone's
**Tailscale IP directly**:

```
k6 run --env BASE_URL=http://<phone-tailscale-ip>:8080 load-test/redirects.js
```

Never point it at a zrok or Tailscale Funnel URL — you'd be benchmarking the
tunnel's rate limit, not your architecture.

## Public access (optional)

To let people outside your tailnet click your shortened links, see
`infra/zrok/README.md` for a self-hosted zrok relay. Keep load testing on
Tailscale directly regardless — never through a public tunnel.

## Watching it live

Open `monitor/dashboard.html` in a browser on your laptop (point it at your
phone's Tailscale IP) while `load-test/redirects.js` runs — it polls both
app instances directly for live req/sec, cache hit ratio, free RAM, and CPU
temp, no setup required.

## Chaos testing

`chaos/kill-and-promote.sh` kills shard0's primary, lets you watch writes
to that shard fail, and walks you through promoting its replica by hand —
see `chaos/README.md` for what that does and doesn't prove about real
failover.

## What's next

Whatever gives out first while you load-test — CPU, thermal throttling,
RAM, or your home upload bandwidth — is your real number. Write it down;
that's the actual deliverable of this whole project.
