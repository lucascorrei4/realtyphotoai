# Backend Dockerfile for RealVisionAI
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for image processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libc6-compat \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for TypeScript build)
RUN npm install && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Create necessary directories
RUN mkdir -p uploads outputs temp logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://0.0.0.0:8000/api/v1/health || exit 1

# Start the application
CMD ["npm", "start"]
