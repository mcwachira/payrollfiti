# apps/web/Dockerfile — TanStack Start, served as a Node process on port 3000
# (Vinxi build -> .output/server/index.mjs)

FROM node:20-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY . .
RUN pnpm dlx turbo prune web --docker

FROM base AS installer
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

# VITE_* build args get inlined into the client bundle at build time
ARG VITE_API_URL=http://localhost:8000/api
ARG VITE_APP_NAME=PayrollFiti
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN pnpm turbo run build --filter=web...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 tanstack

COPY --from=installer --chown=tanstack:nodejs /app/apps/web/.output ./apps/web/.output

USER tanstack
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/.output/server/index.mjs"]