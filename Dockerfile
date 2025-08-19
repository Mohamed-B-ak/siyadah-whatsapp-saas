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
# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN mkdir -p /app/logs /app/tokens /app/uploads /app/userDataDir /app/WhatsAppImages && \
    chown -R appuser:appuser /app
USER appuser
EXPOSE 5000
# Run directly with tsx (no build needed)
CMD ["npx", "tsx", "src/server.ts"]