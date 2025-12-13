# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for Prisma (OpenSSL required for Prisma Client)
RUN apk add --no-cache openssl

# Copy root package files for workspaces
COPY package*.json ./

# Copy packages (schemas) first
COPY packages ./packages/

# Copy server package files
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

# Install all dependencies (including devDependencies for build)
# --ignore-scripts skips husky install which fails in Docker
RUN npm ci --ignore-scripts

# Build schemas package first
RUN npm run build --workspace=@secure-auth/schemas

# Generate Prisma Client
WORKDIR /app/server
RUN npx prisma generate

# Copy server source code
COPY server/tsconfig.json ./
COPY server/src ./src/

# Build TypeScript
RUN npm run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S expressjs -u 1001 -G nodejs

# Copy root package files for workspaces
COPY package*.json ./

# Copy packages (schemas - built version)
COPY --from=builder /app/packages ./packages/

# Copy server package files
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

# Install production dependencies only
# --ignore-scripts skips husky install, --omit=dev excludes devDependencies
RUN npm ci --ignore-scripts --omit=dev && \
    npm cache clean --force

# Generate Prisma Client for production
WORKDIR /app/server
RUN npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/server/dist ./dist

# Security: Remove npm and npx from production image (not needed at runtime)
# This eliminates vulnerabilities in npm's bundled dependencies
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Change ownership to non-root user
RUN chown -R expressjs:nodejs /app

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Use dumb-init to handle signals properly (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "dist/index.js"]
