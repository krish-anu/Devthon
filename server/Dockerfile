# ============================================
# NestJS Backend Dockerfile (Development)
# ============================================

# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install OpenSSL, CA certificates and runtime deps needed by Prisma
RUN apk add --no-cache openssl ca-certificates libc6-compat curl bash && update-ca-certificates || true

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including dev dependencies for development)
# Use legacy-peer-deps to avoid peer dependency resolution failures in CI/build
RUN npm ci --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Apply database migrations
RUN npx prisma migrate

# Seed the database (runs `prisma db seed` which uses `ts-node prisma/seed.ts`)
# RUN npx prisma db seed || echo "Prisma seed failed (continuing build)"

# Copy the rest of the application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose the backend port (4000 as per main.ts)
EXPOSE 4000

# Start the application in development mode with watch
# Note: Migrations are not run automatically since the database is already set up
# To run migrations manually: docker compose exec backend npx prisma migrate deploy
CMD ["npm", "run", "start:dev"]
