#!/bin/bash
echo "🚀 Setting up Node.js WhatsApp Client"
echo "======================================"

# Step 1: Install Node.js dependencies
echo "📦 Installing dependencies..."
cd whatsapp_client_nodejs
npm install
cd ..

echo "✅ Dependencies installed successfully!"
echo ""
echo "🎯 How to run the Node.js WhatsApp client:"
echo ""
echo "Option 1 - Run integration server (like your Python Flask app):"
echo "   node whatsapp_nodejs_integration.js"
echo ""
echo "Option 2 - Run interactive test:"
echo "   cd whatsapp_client_nodejs && node test.js --interactive"
echo ""
echo "Option 3 - Run basic test:"
echo "   cd whatsapp_client_nodejs && npm test"
echo ""
echo "🔧 The integration server will:"
echo "   • Start Express server on port 3000"
echo "   • Configure webhook with your ngrok URL" 
echo "   • Send test message to +21621219217"
echo "   • Handle incoming WhatsApp messages"
echo "   • Provide /api/send-message endpoint"
echo ""
echo "📡 Make sure your ngrok is running on port 3000:"
echo "   ngrok http 3000"
echo ""