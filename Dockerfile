FROM node:22-slim

# Chrome runtime deps
RUN apt-get update && apt-get install -y \
  wget gnupg ca-certificates curl unzip \
  fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
  libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils libu2f-udev \
  libvulkan1 --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Install Google Chrome (proper keyring + dearmor)
RUN apt-get update && apt-get install -y gnupg ca-certificates && \
  install -m 0755 -d /usr/share/keyrings && \
  wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
  apt-get update && \
  apt-get install -y google-chrome-stable && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps

# Non-root user
RUN groupadd -r appuser && useradd -m -r -g appuser appuser && \
  mkdir -p /app/logs /app/tokens /app/uploads /app/userDataDir /app/WhatsAppImages && \
  chown -R appuser:appuser /app
USER appuser

# Puppeteer env
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

EXPOSE 5000
CMD ["npx", "tsx", "src/server.ts"]
