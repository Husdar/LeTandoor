FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/frontend

FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
