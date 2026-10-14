// Load test for the redirect path — the endpoint your caching and replica
// setup are actually built for. Seeds a handful of links (staying under the
// 30/min rate limit on /api/shorten), then ramps concurrent traffic against
// their redirects.
//
// Run from your laptop or another machine, pointed at the phone's Tailscale
// IP directly:
//
//   k6 run --env BASE_URL=http://<phone-tailscale-ip>:8080 load-test/redirects.js
//
// Never run this through zrok or Tailscale Funnel — you will hit the
// tunnel's rate limit long before you hit your server's, and end up
// measuring the tunnel instead of your architecture.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const SEED_COUNT = 20; // stays comfortably under the rate limiter

export const options = {
  scenarios: {
    redirects: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 300 },
        { duration: '1m', target: 600 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const codes = [];
  for (let i = 0; i < SEED_COUNT; i++) {
    const res = http.post(
      `${BASE_URL}/api/shorten`,
      JSON.stringify({ url: `https://example.com/page-${i}` }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (res.status === 201) {
      codes.push(JSON.parse(res.body).short_code);
    }
  }
  if (codes.length === 0) {
    throw new Error('Seeding failed — is the API reachable at BASE_URL?');
  }
  return { codes };
}

export default function (data) {
  const code = data.codes[Math.floor(Math.random() * data.codes.length)];
  const res = http.get(`${BASE_URL}/${code}`, { redirects: 0 });
  check(res, { 'redirected (302)': (r) => r.status === 302 });
  sleep(0.1);
}
