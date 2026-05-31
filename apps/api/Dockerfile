FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN corepack enable

FROM base AS pruner

RUN npm install -g turbo@^2

COPY . .

RUN turbo prune @markr/api --docker

FROM base AS installer

COPY --from=pruner /app/out/json/ .

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json

RUN pnpm turbo build --filter=@markr/api

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=4567

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --create-home --home-dir /home/markr --uid 1001 --gid nodejs markr \
  && mkdir -p /data \
  && chown markr:nodejs /data

COPY --from=installer --chown=markr:nodejs /app .

USER markr

EXPOSE 4567

CMD ["pnpm", "--filter", "@markr/api", "start"]
