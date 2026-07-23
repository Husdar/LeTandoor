FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm install

COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN npm run build --workspace=packages/shared
RUN npm run prisma:generate --workspace=apps/backend
RUN npm run build --workspace=apps/backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/backend ./apps/backend

WORKDIR /app/apps/backend
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
