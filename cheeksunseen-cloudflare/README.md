# cheeksunseen — Cloudflare version

Cloudflare Workers + D1 + static assets.

1. Put your D1 database ID into `wrangler.toml`.
2. Set Worker secrets/variables: `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
3. Apply the migration: `npx wrangler d1 migrations apply cheeksunseen-db --remote`
4. Deploy: `npx wrangler deploy`

For Workers Builds with this repository layout, the root should point at the directory containing `wrangler.toml`; the build command can be empty and the deploy command is `npx wrangler deploy`.
