FROM node:22-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
  wget gnupg ca-certificates curl unzip \
  fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
  libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils libu2f-udev \
  libvulkan1 --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Install Chrome (modern keyring method)
RUN install -m 0755 -d /usr/share/keyrings && \
  wget -qO /usr/share/keyrings/google-linux-signing-keyring.gpg https://dl.google.com/linux/linux_signing_key.pub && \
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux-signing-keyring.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
  apt-get update && \
  apt-get install -y google-chrome-stable && \
  rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN npm install --legacy-peer-deps

# Create non-root user and assign permissions
RUN groupadd -r appuser && useradd -m -r -g appuser appuser && \
  mkdir -p /app/logs /app/tokens /app/uploads /app/userDataDir /app/WhatsAppImages && \
  chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Expose port
EXPOSE 5000

# Run your app
CMD ["npx", "tsx", "src/server.ts"]
