# ============================================
# Next.js Frontend Dockerfile (Development)
# ============================================

# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for development)
# Use legacy-peer-deps to avoid peer dependency resolution failures in CI/build
RUN npm ci --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Expose the frontend port (3000 is Next.js default)
EXPOSE 3000

# Start Next.js in development mode with hot reload
CMD ["npm", "run", "dev"]
