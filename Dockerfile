# ProofWall for any Docker host (Fly.io, Railway, Render, a VPS, Coolify…).
# Data (SQLite database + uploaded images) lives in /data — mount a persistent volume there.
#
#   docker build -t proofwall .
#   docker run -p 8080:8080 -v proofwall-data:/data \
#     -e ADMIN_PASSWORD=… -e SESSION_SECRET=$(openssl rand -hex 32) proofwall

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:node

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    NODE_NO_WARNINGS=1
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/migrations ./migrations
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/favicon.svg').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.mjs"]
