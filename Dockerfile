# Use Node.js 22 slim as base image
FROM node:22-slim
# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
# Set working directory
WORKDIR /app
# Copy package files first for better caching
COPY package*.json ./
# Install all dependencies first (needed for build)
RUN npm ci
# Copy all source files
COPY . .
# Build TypeScript to JavaScript
RUN npm run build
# Remove dev dependencies after build to reduce image size
RUN npm prune --omit=dev
# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/tokens /app/uploads /app/userDataDir /app/wppconnect_tokens && \
    chown -R appuser:appuser /app
# Switch to non-root user
USER appuser
# Expose port 5000
EXPOSE 5000
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1
# Start the application
CMD ["npm", "start"]