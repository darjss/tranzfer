# Tranzfer

Tranzfer is a Cloudflare-native large-file transfer app built with Astro, SolidJS, Better Auth, Polar, D1, R2, and Alchemy.

## Commands

```bash
bun install
bun run dev
bun run build
bun run deploy
```

## Required Environment

```bash
ALCHEMY_PASSWORD=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
TRUSTED_ORIGINS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
POLAR_SERVER=sandbox
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_PRODUCT_PRO_ID=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

## Notes

- Production routing is managed in `alchemy.run.ts`.
- Browser uploads use presigned R2 URLs, so bucket CORS and R2 API credentials are required.
- D1 migrations live in `drizzle/migrations`.
