# ⚡ LinkShrink: High-Throughput Sharded URL Engine

<div align="center">

[![Node.js](https://img.shields.io/badge/Runtime-Node.js_v20%2B-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_Multi--Shard-4169E1.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Valkey](https://img.shields.io/badge/Cache-Valkey_%2F_Redis-DC382D.svg?style=for-the-badge&logo=redis&logoColor=white)](https://valkey.io/)
[![Nginx](https://img.shields.io/badge/Load_Balancer-Nginx-009639.svg?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org/)
[![k6](https://img.shields.io/badge/Load_Testing-k6-7D64FF.svg?style=for-the-badge&logo=k6&logoColor=white)](https://k6.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**An ultra-resilient, horizontally sharded, memory-cached, and replicated edge URL redirection service engineered for maximum throughput on resource-constrained hardware.**

</div>

---

## 🚀 Architecture Highlights

LinkShrink is designed to push bare-metal edge hardware (e.g. an Android chroot or compact Linux server) to its physical limits. Rather than a monolithic server, it deploys:
1. **Nginx Reverse Proxy & Load Balancer:** Distributes incoming traffic across multiple independent Node.js application instances.
2. **Dual-Shard PostgreSQL Topology:** Shards data across 4 database clusters:
   - **Shard 0:** Primary (port `5432`) + Streaming Read Replica (port `5434`).
   - **Shard 1:** Primary (port `5433`) + Streaming Read Replica (port `5435`).
3. **In-Memory Valkey Cache:** Sub-millisecond redirect lookups with TTL caching and token-bucket creation rate-limiting.
4. **Live Telemetry HUD (`monitor/dashboard.html`):** Real-time dashboard graphing requests per second, cache hit ratio, system memory, and CPU temperature.

---

## 🏛️ Topology Diagram

```mermaid
graph TD
    CLIENT[Inbound Client Traffic] -->|Port 8080| NGINX[Nginx Load Balancer]
    
    subgraph "Application Cluster"
        NGINX -->|Round Robin| APP1[App Instance 1 :3000]
        NGINX -->|Round Robin| APP2[App Instance 2 :3001]
    end

    subgraph "Caching & Rate Limiting"
        APP1 <-->|Sub-ms Lookups| VALKEY[(Valkey Cache)]
        APP2 <-->|Sub-ms Lookups| VALKEY
    end

    subgraph "PostgreSQL Shard 0"
        APP1 -->|Hash Routing| S0_PRI[(Shard 0 Primary :5432)]
        APP2 -->|Hash Routing| S0_PRI
        S0_PRI -.->|WAL Streaming Replication| S0_REP[(Shard 0 Replica :5434)]
        S0_REP -->|Read Fallback| APP1
    end

    subgraph "PostgreSQL Shard 1"
        APP1 -->|Hash Routing| S1_PRI[(Shard 1 Primary :5433)]
        APP2 -->|Hash Routing| S1_PRI
        S1_PRI -.->|WAL Streaming Replication| S1_REP[(Shard 1 Replica :5435)]
        S1_REP -->|Read Fallback| APP2
    end

    style NGINX fill:#009639,stroke:#fff,stroke-width:2px,color:#fff
    style VALKEY fill:#DC382D,stroke:#fff,stroke-width:2px,color:#fff
    style S0_PRI fill:#4169E1,stroke:#fff,stroke-width:2px,color:#fff
    style S1_PRI fill:#4169E1,stroke:#fff,stroke-width:2px,color:#fff
```

---

## 📦 Directory Structure

```
├── chaos/                  # Failure testing & replica promotion scripts
│   ├── kill-and-promote.sh # Simulates primary node failure & failover
│   └── README.md           # Failure analysis & recovery documentation
├── infra/                  # Provisioning & system services
│   ├── nginx.conf          # Upstream proxy & load balancing rules
│   ├── provision.sh        # Automated setup (Postgres, Valkey, Nginx, Node)
│   ├── setup-shards.sh     # 4-cluster PostgreSQL shard provisioning
│   ├── start-all.sh        # Orchestrated daemon launcher (tmux session)
│   └── zrok/               # Public tunnel relay configuration
├── load-test/              # Performance benchmarking suite
│   └── redirects.js        # k6 load testing script for high-concurrency redirects
├── monitor/                # Real-time monitoring dashboard
│   └── dashboard.html      # Client HUD for latency, RPS, & thermal stats
├── src/                    # Core application source code
│   ├── cache.js            # Valkey caching & rate-limit driver
│   ├── db.js               # Multi-pool database abstraction
│   ├── server.js           # Express REST API routes & health probes
│   └── shardRouter.js      # Deterministic hash ring shard resolver
├── .env.example            # Environment template
└── schema.sql              # Base database schema
```

---

## 🛠️ Setup & Deployment

### 1. Automated Provisioning (Linux / Chroot as Root)
```bash
chmod +x infra/*.sh
./infra/provision.sh
```
This script automates:
- Package installation (`postgresql`, `valkey-server`, `nginx`, `nodejs`, `tmux`).
- Creation of the 4 independent PostgreSQL database clusters.
- Configuration of replication privileges and WAL streaming.
- Nginx upstream site enablement.

Verify all 4 clusters are online:
```bash
pg_lsclusters
```

### 2. Configure Environment & Start Services
```bash
cp .env.example .env
# Edit .env with your chosen credentials

npm install
./infra/start-all.sh
```

---

## 📡 API Reference

### 1. Create Short Link
```http
POST /api/shorten
Content-Type: application/json

{
  "url": "https://example.com/very/long/target/url"
}
```

**Response (`201 Created`):**
```json
{
  "short_code": "aB3xY9",
  "shard": 0,
  "short_url": "http://<host>:8080/aB3xY9",
  "long_url": "https://example.com/very/long/target/url"
}
```

### 2. Redirect to Target URL
```http
GET /:short_code
```
- First hit: Serves from Shard Read Replica, populates Valkey in-memory cache.
- Subsequent hits: Serves directly from Valkey (<1ms latency).

### 3. Query Link Analytics
```http
GET /api/stats/:short_code
```

**Response (`200 OK`):**
```json
{
  "short_code": "aB3xY9",
  "shard": 0,
  "long_url": "https://example.com/very/long/target/url",
  "click_count": 1420,
  "created_at": "2026-10-14T18:00:00.000Z"
}
```

---

## ⚡ Concurrency & Chaos Testing

### Load Testing with k6
Execute the high-concurrency redirection test suite:
```bash
k6 run --env BASE_URL=http://<host-ip>:8080 load-test/redirects.js
```

### Chaos Engineering (Replica Promotion)
Simulate catastrophic failure of Shard 0's primary:
```bash
./chaos/kill-and-promote.sh
```
Watch how write operations fail safely while cached redirects continue serving uninterrupted, followed by manual replica promotion to restore full primary write capabilities.

---

## 📄 License

This repository is licensed under the MIT License. See [LICENSE](LICENSE) for details.
