# Frontend image: Svelte SPA (vite build) served by nginx with SPA fallback.
# Build from the repo root:  docker build -f docker/frontend.Dockerfile -t recipes-frontend .
# Build-time config for production sign-in (Supabase Google OAuth) is passed as build args.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN npm ci --workspace shared --workspace web
COPY shared shared
COPY web web
# Publishable key (sb_publishable_...) and project URL. Passed by docker.yaml from
# repository variables; empty in a local `task docker:build` unless you pass --build-arg.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_AUTH_MODE=supabase \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build -w web

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
ENV API_UPSTREAM=http://backend:3000 NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
