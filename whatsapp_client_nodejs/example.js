/**
 * Node.js WhatsApp Client Example
 * Equivalent to the Python Flask example
 */

const express = require('express');
const WhatsAppClient = require('./WhatsAppClient');
const chalk = require('chalk');

const app = express();
app.use(express.json());

// Initialize WhatsApp client
const whatsappClient = new WhatsAppClient(
    "mohamed_session",
    null,
    "comp_mc7awp6j_6ef95dac217e7acc7d80041077ff5413"
);

function handleIncomingMessage(messageInfo) {
    /**
     * Process incoming WhatsApp messages
     */
    const sender = messageInfo.from;
    const message = messageInfo.body;
    
    // Send auto-reply if needed
    if (message.toLowerCase().includes("help")) {
        whatsappClient.sendMessage(sender, "How can I assist you?");
    }
}

// Add the webhook route to your main Express app
app.post('/webhook', (req, res) => {
    /**
     * Handle incoming webhook from WhatsApp server
     */
    try {
        const data = req.body;
        if (data) {
            // Process the webhook data same way as the client
            const messageInfo = {
                from: data.from || 'unknown',
                body: data.body || data.text || 'N/A',
                type: data.type || 'text',
                timestamp: data.timestamp || Date.now(),
                session: data.session || 'unknown',
                event: data.event || 'message'
            };
            
            // Call your message handler
            handleIncomingMessage(messageInfo);
            
            // Log the message
            console.log(chalk.cyan(`📱 Received: ${messageInfo.body} from ${messageInfo.from}`));
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        console.log(chalk.red(`Webhook error: ${error.message}`));
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to send messages
app.post('/api/send-message', async (req, res) => {
    const { phone, message } = req.body;
    
    const success = await whatsappClient.sendMessage(phone, message);
    res.json({ success });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function main() {
    try {
        // Configure server webhook to point to this app
        const axios = require('axios');
        const response = await axios.post(
            `${whatsappClient.serverUrl}/api/webhook/configure`,
            { webhookUrl: "https://70c3-197-17-32-151.ngrok-free.app/webhook" },
            { timeout: 10000 }
        );
        console.log(chalk.green(`Webhook configured: ${response.status}`));
    } catch (error) {
        console.log(chalk.yellow(`Webhook config error: ${error.message}`));
    }

    // Send test message
    const success = await whatsappClient.sendMessage("+21621219217", "Hello from Node.js!");
    console.log(chalk.blue(`Test message sent: ${success}`));

    // Run the main Express app with webhook handler
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(chalk.green(`🚀 Node.js WhatsApp server running on port ${PORT}`));
        console.log(chalk.cyan(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`));
        console.log(chalk.magenta(`🔗 Send messages API: http://localhost:${PORT}/api/send-message`));
    });
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = app;