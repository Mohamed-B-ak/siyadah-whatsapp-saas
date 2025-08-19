FROM node:22-slim

# Install Chrome and dependencies for Render deployment
RUN apt-get update && \
    apt-get install -y wget gnupg2 curl xvfb && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Set Chrome environment variables for deployment
ENV DISPLAY=:99
ENV CHROME_BIN=/usr/bin/google-chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
WORKDIR /app
# Copy everything
COPY . .
# Install dependencies
RUN npm install --legacy-peer-deps
# Create non-root user and set up directories
RUN groupadd -r appuser && useradd -r -g appuser -m -d /tmp appuser
RUN mkdir -p /app/logs /app/tokens /app/uploads /app/userDataDir /app/WhatsAppImages && \
    mkdir -p /tmp/chrome-user-data /tmp/chrome-data /tmp/chrome-cache && \
    chmod 755 /tmp/chrome-user-data /tmp/chrome-data /tmp/chrome-cache && \
    chown -R appuser:appuser /app /tmp/chrome-user-data /tmp/chrome-data /tmp/chrome-cache
USER appuser
EXPOSE 5000
# Ensure clean startup on Render
RUN echo '#!/bin/bash\nrm -f /tmp/server.lock\nexec npx tsx src/server.ts' > /app/start.sh && \
    chmod +x /app/start.sh
CMD ["/app/start.sh"]