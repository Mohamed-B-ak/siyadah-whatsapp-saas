FROM node:22-slim
# Install Chrome for WhatsApp Web automation
RUN apt-get update && \
    apt-get install -y wget gnupg2 curl && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*
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