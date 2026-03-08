# --- Stage 1: Build Environment ---
# Use a specific, slim Node.js image for the build stage to get necessary tools
FROM node:24-bullseye-slim AS build

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies. Use 'npm ci' for deterministic installs and only production dependencies.
# Use cache mounts for faster rebuilds (requires BuildKit)
RUN --mount=type=cache,target=/root/.npm npm ci --only=production --no-audit --no-fund

# Copy the rest of the application source code
COPY . .

FROM node:24-bullseye-slim AS runtime

# Create a non-root user and group for security best practices
RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup -m -d /app -s /bin/false appuser

# Set environment variable for optimized Node.js execution
ENV NODE_ENV=development

# Set the working directory
WORKDIR /app

# Copy only the necessary files (node_modules and app code) from the 'build' stage
COPY --chown=appuser:appgroup --from=build /usr/src/app ./

# Expose the port your app runs on (e.g., 3000). Avoid privileged ports (1-1023)
EXPOSE 3000

# Switch to the non-root user
USER appuser

# Command to run the application. Avoid "npm start" as it can have issues with signal handling.
# Use the direct node command as specified in your package.json's "start" script.
CMD ["node", "src/server.js"]