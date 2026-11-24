FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

# Dependencies layer cached
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts

# Prisma schema cached separately from application source
COPY prisma ./prisma/
RUN NODE_OPTIONS=--dns-result-order=ipv4first npx prisma generate

# Application build
COPY . .
RUN NODE_OPTIONS=--dns-result-order=ipv4first npm run build

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output contains only needed production dependencies
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma

RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]

