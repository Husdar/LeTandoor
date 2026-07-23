#!/bin/sh
set -e

npx prisma migrate deploy --schema=./prisma/schema.prisma
npx tsx prisma/seed.ts
node dist/server.js
