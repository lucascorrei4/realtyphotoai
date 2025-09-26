# Frontend Dockerfile for RealVisionAI
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy all source files
COPY . ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

# Install curl for health checks
RUN apk add --no-cache curl

# Use existing nginx user (already exists in nginx:alpine)
# No need to create user as nginx user already exists

# Change ownership of nginx directories
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Create nginx pid directory and set permissions
RUN mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx && \
    chmod 755 /var/run/nginx

# Switch to nginx user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
