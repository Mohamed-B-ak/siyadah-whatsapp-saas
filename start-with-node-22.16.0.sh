#!/bin/bash
# Startup script to use Node.js 22.16.0 specifically
export PATH=~/node-22.16.0/bin:$PATH
echo "🚀 Using Node.js version: $(node --version)"
echo "📦 Using NPM version: $(npm --version)"
echo "📍 Node path: $(which node)"

# Kill any existing tsx processes
pkill -f tsx || true

# Start the application with the specific Node.js version
exec ~/node-22.16.0/bin/node ~/node-22.16.0/bin/npm run dev