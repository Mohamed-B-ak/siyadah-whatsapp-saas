# WhatsApp Client - Node.js

Complete Node.js library for sending and receiving WhatsApp messages with built-in webhook server for real-time message processing.

## Installation

Install dependencies:

```bash
cd whatsapp_client_nodejs
npm install
```

## Quick Start

### Basic Message Sending

```javascript
const WhatsAppClient = require('./WhatsAppClient');

// Create client with API key for identification
const client = new WhatsAppClient(
    "mohamed_session",
    null,
    "comp_mc7awp6j_6ef95dac217e7acc7d80041077ff5413"
);

// Send a message
const success = await client.sendMessage("+21653844063", "Hello from Node.js!");
console.log(`Message sent: ${success}`);

// Check connection status
const status = client.getStatus();
console.log(`Connected: ${status.webhook_running}`);
```

### Complete Send/Receive Integration with Webhooks

```javascript
const WhatsAppClient = require('./WhatsAppClient');

function handleIncomingMessage(messageInfo) {
    console.log(`📱 New message from ${messageInfo.from}`);
    console.log(`💬 Message: ${messageInfo.body}`);
    
    // Add your business logic here:
    // - Save to database
    // - Send auto-reply
    // - Trigger notifications
}

// Initialize client
const client = new WhatsAppClient(
    "mohamed_session",
    null,
    "comp_mc7awp6j_6ef95dac217e7acc7d80041077ff5413"
);

// Start webhook server to receive incoming messages
console.log("🎣 Starting webhook server...");
await client.startWebhookListener(3000, handleIncomingMessage);

// Send a test message
await client.sendMessage("+21653844063", "Testing webhook integration!");

// Listen for incoming messages for 60 seconds
console.log("👂 Listening for incoming messages...");
await client.listenForMessages(60);

// Stop webhook server
client.stopWebhookListener();
console.log("🏁 Webhook integration complete!");
```

### Express.js Integration (Like Flask Example)

```javascript
const express = require('express');
const WhatsAppClient = require('./WhatsAppClient');

const app = express();
app.use(express.json());

const whatsappClient = new WhatsAppClient(
    "mohamed_session",
    null,
    "comp_mc7awp6j_6ef95dac217e7acc7d80041077ff5413"
);

function handleIncomingMessage(messageInfo) {
    const sender = messageInfo.from;
    const message = messageInfo.body;
    
    if (message.toLowerCase().includes("help")) {
        whatsappClient.sendMessage(sender, "How can I assist you?");
    }
}

// Webhook endpoint
app.post('/webhook', (req, res) => {
    const data = req.body;
    if (data) {
        const messageInfo = {
            from: data.from || 'unknown',
            body: data.body || data.text || 'N/A',
            type: data.type || 'text',
            timestamp: data.timestamp || Date.now(),
            session: data.session || 'unknown',
            event: data.event || 'message'
        };
        
        handleIncomingMessage(messageInfo);
        console.log(`📱 Received: ${messageInfo.body} from ${messageInfo.from}`);
    }
    
    res.json({ status: 'ok' });
});

// API endpoint to send messages
app.post('/api/send-message', async (req, res) => {
    const { phone, message } = req.body;
    const success = await whatsappClient.sendMessage(phone, message);
    res.json({ success });
});

app.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Server running on port 3000');
});
```

### Bulk Messaging

```javascript
const WhatsAppClient = require('./WhatsAppClient');

const client = new WhatsAppClient();

// Send messages to multiple recipients
const recipients = [
    { phone: "21653844063", message: "Message 1" },
    { phone: "21653844063", message: "Message 2" }
];

const results = await client.sendBulkMessages(recipients, 2);
console.log(`Success: ${results.sent}, Failed: ${results.failed}`);
```

## API Methods

### `new WhatsAppClient(sessionName, serverUrl, apiKey)`
- **sessionName**: WhatsApp session name (default: "mohamed_session")
- **serverUrl**: API server URL (uses default if not provided)
- **apiKey**: Master API Key for identification

### `await sendMessage(phone, message)`
Send a WhatsApp message
- **phone**: Phone number (e.g., "21653844063")
- **message**: Message text to send
- **Returns**: Promise<boolean> - true if sent successfully

### `await sendBulkMessages(recipients, delay)`
Send messages to multiple recipients
- **recipients**: Array of {phone, message} objects
- **delay**: Delay between messages in seconds
- **Returns**: Promise<Object> - results summary

### `await isConnected()`
Check if WhatsApp session is connected
- **Returns**: Promise<boolean> - true if connected

### `await startWebhookListener(port, callback, ngrokUrl)`
Start webhook server to receive incoming messages
- **port**: Port to run webhook server (default: 3000)
- **callback**: Function to handle incoming messages
- **ngrokUrl**: Public URL for webhook forwarding
- **Returns**: Promise<boolean> - true if started successfully

### `stopWebhookListener()`
Stop the webhook server
- **Returns**: boolean - true if stopped successfully

### `getReceivedMessages()`
Get all received messages
- **Returns**: Array of message objects

### `clearReceivedMessages()`
Clear all received messages from memory

### `await listenForMessages(duration)`
Listen for incoming messages for a specified duration
- **duration**: Time to listen in seconds (default: 30)

### `getStatus()`
Get detailed status information
- **Returns**: Object with client status

## Running Examples

```bash
# Run basic test
npm test

# Run interactive mode
node test.js --interactive

# Run Express.js server example
npm run example
```

## Dependencies

- **axios**: HTTP client for API requests
- **express**: Web framework for webhook server
- **chalk**: Terminal string styling for colored output

## Features

- ✅ Send individual WhatsApp messages
- ✅ Send bulk messages with delay
- ✅ Receive incoming messages via webhooks
- ✅ Real-time message processing with callbacks
- ✅ Automatic authentication and token management
- ✅ Express.js integration support
- ✅ Colored terminal output for better debugging
- ✅ Connection status monitoring
- ✅ Message history management

## Integration Notes

This Node.js library provides the exact same functionality as the Python version, with the same API structure and webhook capabilities. You can easily integrate it into Express.js applications just like the Flask example.