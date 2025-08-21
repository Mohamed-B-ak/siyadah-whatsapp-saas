# Build stage
FROM node:20-bullseye AS build

# Puppeteer/Chrome deps (use system Chromium to keep image simple)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libdrm2 libgbm1 libgtk-3-0 libnss3 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    xdg-utils ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
# Install prod deps (include prom-client) and dev deps needed to build (typescript)
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-bullseye

# Install only runtime pieces (Chromium + libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libdrm2 libgbm1 libgtk-3-0 libnss3 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    xdg-utils ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Helpful default flags for Chrome in containers
ENV PUPPETEER_DEFAULT_ARGS="--no-sandbox --disable-dev-shm-usage --disable-gpu"

WORKDIR /app
# Copy node_modules from build stage (already pruned by NODE_ENV=production during npm ci)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# (optional) run as non-root
RUN useradd -m -d /home/appuser appuser
USER appuser

# Render provides $PORT. Make sure your server listens on 0.0.0.0:$PORT
EXPOSE 10000
CMD ["node", "dist/server.js"]