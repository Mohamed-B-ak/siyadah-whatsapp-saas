# 1) Pin exact Node patch version
FROM node:22.16.0-slim

# 2) Install Google Chrome (signed-by keyring; cleaner layers)
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg2 ca-certificates curl xvfb \
 && wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
    | gpg --dearmor -o /usr/share/keyrings/google-linux.gpg \
 && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list \
 && apt-get update && apt-get install -y --no-install-recommends \
    google-chrome-stable \
 && rm -rf /var/lib/apt/lists/*

# 3) Runtime env for Puppeteer/Chrome in containers
ENV NODE_ENV=production
# Skip husky inside containers (no git hooks needed during build)
ENV HUSKY=0
ENV DISPLAY=:99
ENV CHROME_BIN=/usr/bin/google-chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
# Optional: many hosts require these flags
ENV PUPPETEER_DEFAULT_ARGS="--no-sandbox --disable-dev-shm-usage --disable-gpu"

# 4) App setup
WORKDIR /app

# Copy only manifests first so Docker can cache deps
COPY package.json package-lock.json* ./

# Install production deps WITHOUT running lifecycle scripts (skips husky)
# Then rebuild native modules (if any)
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --ignore-scripts --legacy-peer-deps; \
    else \
      npm i  --omit=dev --ignore-scripts --legacy-peer-deps; \
    fi \
 && npm rebuild

# Now copy the rest of the source
COPY . .

# 5) Non-root user and writable dirs
RUN groupadd -r appuser && useradd -r -g appuser -m -d /tmp appuser \
 && mkdir -p /app/logs /app/tokens /app/uploads /app/userDataDir /app/WhatsAppImages \
           /tmp/chrome-user-data /tmp/chrome-data /tmp/chrome-cache \
 && chmod 755 /tmp/chrome-user-data /tmp/chrome-data /tmp/chrome-cache \
 && chown -R appuser:appuser /app /tmp/chrome-user-data /tmp/chrome-data /tmp/chrome-cache
USER appuser

EXPOSE 5000

# 6) Start: run with tsx at runtime (no build)
# Ensure "tsx" is in dependencies OR allow npx to fetch it at runtime.
CMD ["npx", "tsx", "src/server.ts"]
