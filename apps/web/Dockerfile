# apps/web/Dockerfile — Next.js, served via `next start` standalone output on port 3000
#
# Requires next.config.js to set `output: 'standalone'` — without it,
# .next/standalone won't exist and this build will fail at the COPY step
# in the runner stage below.

FROM node:22-alpine AS base
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
# turbo prune --docker doesn't include pnpm-workspace.yaml in out/json/ (it
# only carries package.json files + the lockfile there) — copy it in
# explicitly so pnpm sees onlyBuiltDependencies during install, not after.
COPY --from=pruner /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

# NEXT_PUBLIC_* build args get inlined into the client bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ARG NEXT_PUBLIC_APP_NAME=PayrollFiti
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}

RUN pnpm turbo run build --filter=web...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
