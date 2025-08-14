/**
 * Test Node.js WhatsApp Client
 * Equivalent to the Python test scripts
 */

const WhatsAppClient = require('./WhatsAppClient');
const chalk = require('chalk');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function testWhatsAppClient() {
    console.log(chalk.blue('🧪 Testing Node.js WhatsApp Client'));
    console.log('='.repeat(50));
    
    // Initialize client
    const client = new WhatsAppClient(
        "test_session",
        null,
        "comp_mc7awp6j_6ef95dac217e7acc7d80041077ff5413"
    );
    
    // Test 1: Check status
    console.log('\n1. Checking client status...');
    const status = client.getStatus();
    console.log('   Status:', status);
    
    // Test 2: Check connection
    console.log('\n2. Checking WhatsApp connection...');
    const connected = await client.isConnected();
    console.log('   Connected:', connected);
    
    // Test 3: Send a test message
    console.log('\n3. Testing message sending...');
    const phoneNumber = await new Promise((resolve) => {
        rl.question('   Enter phone number (e.g., 21653844063): ', resolve);
    });
    
    if (phoneNumber.trim()) {
        const testMessage = `Hello! This is a test message from Node.js client at ${new Date().toLocaleTimeString()}`;
        console.log(`   Sending message to ${phoneNumber}...`);
        
        const success = await client.sendMessage(phoneNumber, testMessage);
        if (success) {
            console.log(chalk.green('   ✅ Message sent successfully!'));
        } else {
            console.log(chalk.red('   ❌ Failed to send message'));
        }
    } else {
        console.log('   Skipping message test - no phone number provided');
    }
    
    // Test 4: Start webhook listener
    console.log('\n4. Starting webhook listener...');
    const webhookStarted = await client.startWebhookListener(
        3000,
        (messageInfo) => {
            console.log(chalk.magenta(`📨 Callback received: ${messageInfo.body} from ${messageInfo.from}`));
        },
        "https://70c3-197-17-32-151.ngrok-free.app"
    );
    console.log('   Webhook started:', webhookStarted);
    
    if (webhookStarted) {
        console.log('\n5. Listening for messages for 60 seconds...');
        console.log('   Send a WhatsApp message to test receiving!');
        console.log('   (Reply to the test message or send a new one)');
        
        // Listen for messages
        await client.listenForMessages(60);
        
        // Show received messages
        const messages = client.getReceivedMessages();
        console.log(`\n   Total messages received: ${messages.length}`);
        messages.forEach((msg, i) => {
            console.log(`   Message ${i + 1}: From ${msg.from} - ${msg.body}`);
        });
    }
    
    console.log('\n✅ Node.js client test completed!');
    rl.close();
    process.exit(0);
}

async function interactiveMode() {
    console.log(chalk.blue('🚀 Interactive Node.js WhatsApp Client'));
    console.log('='.repeat(50));
    
    const client = new WhatsAppClient(
        "interactive_test",
        null,
        "comp_mc7awp6j_6ef95dac217e7acc7d80041077ff5413"
    );
    
    // Start webhook listener automatically
    console.log('Starting webhook listener...');
    const webhookStarted = await client.startWebhookListener(
        3000,
        null,
        "https://70c3-197-17-32-151.ngrok-free.app"
    );
    
    if (!webhookStarted) {
        console.log('Failed to start webhook listener');
        rl.close();
        return;
    }
    
    console.log('\n📱 WhatsApp Client Ready!');
    console.log('Commands:');
    console.log('  send <phone> <message> - Send a message');
    console.log('  status - Check connection status');
    console.log('  messages - Show received messages');
    console.log('  clear - Clear received messages');
    console.log('  quit - Exit');
    console.log('\nExample: send 21653844063 Hello from Node.js!');
    console.log('='.repeat(50));
    
    function promptUser() {
        rl.question('\n> ', async (command) => {
            const trimmedCommand = command.trim();
            
            if (!trimmedCommand) {
                promptUser();
                return;
            }
            
            if (trimmedCommand.toLowerCase() === 'quit') {
                console.log('Goodbye!');
                rl.close();
                process.exit(0);
                return;
            }
            
            if (trimmedCommand.toLowerCase() === 'status') {
                const connected = await client.isConnected();
                const status = client.getStatus();
                console.log(`Connected: ${connected}`);
                console.log(`Session: ${status.session_name}`);
                console.log(`Webhook: ${status.webhook_running}`);
                
            } else if (trimmedCommand.toLowerCase() === 'messages') {
                const messages = client.getReceivedMessages();
                if (messages.length > 0) {
                    console.log(`Received ${messages.length} messages:`);
                    messages.forEach((msg, i) => {
                        console.log(`  ${i + 1}. From ${msg.from}: ${msg.body}`);
                    });
                } else {
                    console.log('No messages received yet');
                }
                
            } else if (trimmedCommand.toLowerCase() === 'clear') {
                client.clearReceivedMessages();
                
            } else if (trimmedCommand.startsWith('send ')) {
                const parts = trimmedCommand.split(' ');
                if (parts.length >= 3) {
                    const phone = parts[1];
                    const message = parts.slice(2).join(' ');
                    
                    console.log(`Sending to ${phone}...`);
                    const success = await client.sendMessage(phone, message);
                    
                    if (success) {
                        console.log(chalk.green('✅ Message sent successfully!'));
                    } else {
                        console.log(chalk.red('❌ Failed to send message'));
                    }
                } else {
                    console.log('Usage: send <phone> <message>');
                }
                
            } else {
                console.log('Unknown command. Type "quit" to exit.');
            }
            
            promptUser();
        });
    }
    
    promptUser();
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--interactive') || args.includes('-i')) {
    interactiveMode().catch(console.error);
} else {
    testWhatsAppClient().catch(console.error);
}