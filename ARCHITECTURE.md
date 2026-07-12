# Architecture plan

SULAYER CLOUD PANEL is split into a control plane and a runner. The web application is the control plane: it owns authentication, PostgreSQL records, encrypted variables, audit history, and the operator UI. It never runs a user workload in the Next.js process.

The worker is an independently deployed runner service. It receives authenticated control requests, builds/starts isolated Docker containers, applies resource limits, and writes deployment state and resource observations back to PostgreSQL. A reverse proxy is the only component that publishes approved HTTP endpoints.

```text
Browser → Next.js control plane → authenticated runner request → Docker Engine → unprivileged project container
                   ↘ PostgreSQL / Redis ↗                         ↘ scoped project volume
```

## Implementation checklist

- [x] Monorepo structure, branding configuration, design tokens, responsive shell
- [x] Prisma data model for users, sessions, projects, deployments, encrypted variables, metrics, domains, nodes, and audits
- [x] Environment-initialized admin, Argon2id login, signed session cookie, basic IP rate limit, CSRF-origin verification
- [x] Project creation, runtime presets/detection rules, variable API, deployment/action dispatch APIs
- [x] Separate Docker runner with non-root/container hardening defaults
- [x] Docker Compose, Railway and Render descriptors, health endpoint, deployment documentation
- [ ] GitHub OAuth/webhook UI and provider API credentials (requires administrator OAuth credentials)
- [ ] Production reverse-proxy domain provisioning and persistent log transport (requires deployment environment)

The two unchecked items require external accounts/DNS credentials and are documented as intentional integration points rather than simulated functionality.
