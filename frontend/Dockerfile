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

# Railway sets PORT at runtime; public networking must target the same port.
EXPOSE 3000

# /callback must return 200 (SPA fallback). If `serve` runs without -s, this fails.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/callback',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "exec serve -s dist -l \"${PORT:-3000}\""]