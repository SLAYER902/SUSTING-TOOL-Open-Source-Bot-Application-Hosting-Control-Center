# Contributing

1. Create a focused branch and avoid committing `.env` files, access tokens, or generated user workspaces.
2. Keep project execution in the runner boundary; the control plane must never directly execute workload commands.
3. Preserve secure defaults: non-root containers, restricted capabilities, encrypted values, and explicit authorization.
4. Run `npm test` and `npm run build` before opening a pull request.
5. Describe any provider-specific limitations instead of emulating unsupported infrastructure access.
