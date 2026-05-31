FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN corepack enable

FROM base AS pruner

RUN npm install -g turbo@^2

COPY . .

RUN turbo prune @markr/web --docker

FROM base AS installer

COPY --from=pruner /app/out/json/ .

RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json

RUN pnpm turbo build --filter=@markr/web

FROM base AS runner

ENV NODE_ENV=production
ENV VITE_API_BASE_URL=http://localhost:4567

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --create-home --home-dir /home/markr --uid 1001 --gid nodejs markr

COPY --from=installer --chown=markr:nodejs /app .

USER markr

EXPOSE 3000

CMD ["pnpm", "--filter", "@markr/web", "start"]
