FROM node:22-alpine AS build

WORKDIR /app

COPY ./frontend/package.json ./frontend/package-lock.json ./

RUN npm ci

COPY ./frontend .

RUN npm run build

# ============= Production stage =============
FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["serve", "-s", "dist", "-l", "0.0.0.0:3000"]