# Production image for the dashboard. Built and run by ../backend-napi-tracker/docker-compose.yml.

# Stage 1: install dependencies and build.
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_ values are baked into the browser code here, so changing the API address means
# rebuilding the image. Without this check the bundle would silently point at localhost.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" && npm run build

# Stage 2: only what is needed to run (output: "standalone" in next.config.ts).
FROM node:26-bookworm-slim
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Run as the unprivileged "node" user that the base image provides.
USER node
EXPOSE 3001
# The image has no curl, so the health check uses Node's built-in fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
