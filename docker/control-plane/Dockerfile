FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN npm install
COPY . .
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN npm run build -w @sulayer/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/lib/env.mjs ./apps/web/lib/env.mjs
COPY --from=build /app/apps/web/scripts ./apps/web/scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/database/prisma ./packages/database/prisma
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@sulayer/web"]
