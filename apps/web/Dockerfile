FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN corepack enable

FROM base AS pruner

RUN npm install -g turbo@^2

COPY . .

RUN turbo prune @markr/web --docker

FROM base AS installer

ARG VITE_API_BROWSER_BASE_URL=http://localhost:4567
ARG VITE_API_SERVER_BASE_URL=http://api:4567

ENV VITE_API_BROWSER_BASE_URL=${VITE_API_BROWSER_BASE_URL}
ENV VITE_API_SERVER_BASE_URL=${VITE_API_SERVER_BASE_URL}

COPY --from=pruner /app/out/json/ .

RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json

RUN pnpm turbo build --filter=@markr/web

FROM base AS runner

ENV NODE_ENV=production
ENV VITE_API_BROWSER_BASE_URL=http://localhost:4567
ENV VITE_API_SERVER_BASE_URL=http://api:4567

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --create-home --home-dir /home/markr --uid 1001 --gid nodejs markr

COPY --from=installer --chown=markr:nodejs /app .

USER markr

EXPOSE 3000

CMD ["pnpm", "--filter", "@markr/web", "start"]
