// Prisma CLI (generate/db push/migrate) config. This only runs for the CLI —
// the app's own PrismaClient (src/lib/prisma.ts) reads env vars directly.
//
// Next.js auto-loads .env.local, but the Prisma CLI does not, so we load it
// explicitly here before `env()` is evaluated below.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Unpooled connection — schema changes/migrations should bypass pgbouncer.
    url: env('DATABASE_URL_UNPOOLED'),
  },
});
