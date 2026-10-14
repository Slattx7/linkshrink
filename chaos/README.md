# Chaos testing (optional)

`kill-and-promote.sh` stops shard0's primary mid-traffic, lets you watch
writes to that shard fail, then promotes shard0's replica to take over.
Run it on the phone while `load-test/redirects.js` is hammering the API
from your laptop.

Worth being honest about what this does and doesn't prove: promoting a
replica is one SQL call (`pg_promote()`). Making the app actually use the
newly-promoted primary, in this project, is a manual `.env` edit and a
restart — not automatic. Real automatic failover (detecting the dead
primary and re-routing without a human running a script) is what tools
like Patroni or pg_auto_failover exist to solve, and building that
correctly is a genuinely separate, bigger project than anything else here.
This script teaches you the mechanics; it doesn't replace that tooling.
