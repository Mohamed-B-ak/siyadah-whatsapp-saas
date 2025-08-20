#!/bin/bash
# Development setup script
# Run this after cloning the repo for local development

echo "🔧 Setting up development environment..."

# Install Husky for git hooks (only needed for development)
if command -v husky &> /dev/null; then
    echo "📦 Installing Husky git hooks..."
    husky install
    echo "✅ Husky configured successfully"
else
    echo "⚠️  Husky not found - installing via npm..."
    npm install husky --save-dev
    npx husky install
fi

echo "🚀 Development environment ready!"
echo ""
echo "Available commands:"
echo "  npm run dev      - Start development server"
echo "  npm run test     - Run tests"
echo "  npm run lint     - Check code style"
echo "  git push         - Will run tests and linting automatically"