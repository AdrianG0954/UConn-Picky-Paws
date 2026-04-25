### Build stage
FROM node:22-alpine AS build

WORKDIR /app

# for local dev 
# COPY package.json package-lock.json ./
COPY ./frontend/package.json ./frontend/package-lock.json ./
RUN npm ci

# for local dev
# COPY . .
COPY ./frontend ./
RUN npm run build

### Runtime stage
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
# ENV NODE_ENV=development

# Railway injects PORT at runtime; default locally
ENV PORT=3000

# Only what we need to run `vite preview`
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/vite.config.ts ./vite.config.ts

EXPOSE 3000

# Serve the built assets
CMD ["npm", "run", "start"]