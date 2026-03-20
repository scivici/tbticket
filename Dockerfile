# ============ Build Stage ============
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY shared/ ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies
RUN npm ci

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Build client
RUN npm run build -w client

# ============ Production Stage ============
FROM node:22-alpine AS production

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY shared/ ./shared/
COPY server/package.json ./server/

# Install production dependencies only (server)
RUN npm ci --workspace=server --omit=dev

# Copy server source (runs via tsx in dev, but we'll use tsx in prod too for simplicity)
COPY server/ ./server/

# Copy built client to serve as static files
COPY --from=builder /app/client/dist ./client/dist

# Create directories
RUN mkdir -p /app/server/data /app/server/uploads

# Environment
ENV NODE_ENV=production
ENV PORT=4001
ENV DB_PATH=/app/server/data/tickets.db
ENV UPLOAD_DIR=/app/server/uploads

EXPOSE 4001

# Install tsx for running TypeScript directly
RUN npm install -g tsx

CMD ["tsx", "server/src/index.ts"]
