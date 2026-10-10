# Backend image: Hono API bundled (esbuild, includes @recipes/shared) into one file, run by node.
# Build from the repo root:  docker build -f docker/backend.Dockerfile -t recipes-backend .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN npm ci --workspace shared --workspace api
COPY shared shared
COPY api api
# Typechecking is the CI gate (task lint); the image build only bundles.
RUN npm run bundle -w api

FROM node:22-alpine
# Production: dev auth and the Claude stub are refused at startup when NODE_ENV=production.
ENV NODE_ENV=production PORT=3000 STORE=supabase AUTH_MODE=supabase DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/api/bundle/server.mjs server.mjs
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
