# Security model

SULAYER CLOUD PANEL is for authorized projects and infrastructure only. It does not expose an SSH service, host networking, privileged project containers, Docker sockets, or raw stored secret values to workloads.

## Defaults

- Initial credentials are read once from environment variables, validated, and Argon2id-hashed.
- Sessions are signed, HTTP-only, `SameSite=Lax` cookies backed by a server-side session record.
- Mutating control-plane routes validate same-origin requests and enforce role checks.
- Variable values use AES-256-GCM with `ENCRYPTION_KEY`; APIs return metadata only.
- The runner, not the web process, builds and starts project containers.
- Runner-created containers are non-root, have `no-new-privileges`, all Linux capabilities dropped, an internal network, PID/CPU/RAM limits, and a read-only root filesystem with a bounded `/tmp`.

## Operational note

Docker socket access grants high privilege. Keep it mounted only in the runner service, restrict administrator access to the host, and never bind it into a customer/project container. Use a dedicated runner host where practical.

Report vulnerabilities privately to the deployment administrator. Do not file secrets in public issues.
