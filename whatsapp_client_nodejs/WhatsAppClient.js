/**
 * WhatsApp Client - Node.js Library
 * Easy-to-use WhatsApp messaging client with working authentication
 */

const axios = require('axios');
const express = require('express');
const chalk = require('chalk');

class WhatsAppClient {
    constructor(sessionName = "mohamed_session", serverUrl = null, apiKey = null) {
        /**
         * Initialize WhatsApp client
         * 
         * @param {string} sessionName - Name of the WhatsApp session
         * @param {string} serverUrl - Server URL (optional, uses default if not provided)
         * @param {string} apiKey - Master API Key (for identification purposes, still requires token auth)
         */
        this.sessionName = sessionName;
        this.serverUrl = serverUrl || "https://3e0f14cc-731c-4c72-96e7-feb806c5128b-00-39cvzl2tdyxjo.sisko.replit.dev";
        this.apiKey = apiKey;
        this.secretKey = null;
        this.authToken = null;
        this.authenticated = false;

        // Webhook functionality
        this.webhookApp = null;
        this.webhookServer = null;
        this.webhookPort = null;
        this.webhookRunning = false;
        this.messageCallback = null;
        this.receivedMessages = [];

        // Always authenticate with token generation
        this._authenticate();
    }

    async _authenticate() {
        /**
         * Internal authentication method
         */
        try {
            // Get secret key
            const secretResponse = await axios.get(`${this.serverUrl}/api/secret-key`, { timeout: 10000 });
            if (secretResponse.status === 200) {
                this.secretKey = secretResponse.data.secretKey || '';
            } else {
                return false;
            }

            // Generate auth token
            const tokenResponse = await axios.post(
                `${this.serverUrl}/api/${this.sessionName}/${this.secretKey}/generate-token`,
                {},
                { timeout: 10000 }
            );

            if (tokenResponse.status === 201) {
                this.authToken = tokenResponse.data.full || '';
                this.authenticated = true;
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    async isConnected() {
        /**
         * Check if WhatsApp session is connected
         * 
         * @returns {Promise<boolean>} True if connected, False otherwise
         */
        if (!this.authenticated) {
            return false;
        }

        try {
            const response = await axios.get(
                `${this.serverUrl}/api/${this.sessionName}/check-connection-session`,
                {
                    headers: { 'Authorization': `Bearer ${this.authToken}` },
                    timeout: 10000
                }
            );

            if (response.status === 200) {
                return response.data.status === 'CONNECTED';
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async sendMessage(phone, message) {
        /**
         * Send a WhatsApp message
         * 
         * @param {string} phone - Phone number (e.g., "21653844063")
         * @param {string} message - Message text to send
         * @returns {Promise<boolean>} True if message sent successfully, False otherwise
         */
        if (!this.authenticated) {
            if (!(await this._authenticate())) {
                return false;
            }
        }

        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            };

            const payload = {
                phone: phone,
                message: message
            };

            const response = await axios.post(
                `${this.serverUrl}/api/${this.sessionName}/send-message`,
                payload,
                { headers, timeout: 30000 }
            );

            return [200, 201].includes(response.status);

        } catch (error) {
            // Try re-authentication once on failure
            if (await this._authenticate()) {
                try {
                    const headers = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.authToken}`
                    };
                    const payload = { phone, message };
                    const response = await axios.post(
                        `${this.serverUrl}/api/${this.sessionName}/send-message`,
                        payload,
                        { headers, timeout: 30000 }
                    );
                    return [200, 201].includes(response.status);
                } catch (retryError) {
                    return false;
                }
            }
            return false;
        }
    }

    async sendBulkMessages(recipients, delay = 2) {
        /**
         * Send messages to multiple recipients
         * 
         * @param {Array} recipients - Array of objects with 'phone' and 'message' keys
         * @param {number} delay - Delay between messages in seconds
         * @returns {Object} Results summary
         */
        const results = { sent: 0, failed: 0, details: [] };

        for (const recipient of recipients) {
            const phone = recipient.phone;
            const message = recipient.message;

            if (!phone || !message) {
                results.failed++;
                results.details.push({
                    phone: phone,
                    status: 'failed',
                    error: 'Missing phone or message'
                });
                continue;
            }

            const success = await this.sendMessage(phone, message);
            if (success) {
                results.sent++;
                results.details.push({ phone: phone, status: 'sent' });
            } else {
                results.failed++;
                results.details.push({ phone: phone, status: 'failed' });
            }

            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
        }

        return results;
    }

    getStatus() {
        /**
         * Get detailed status information
         * 
         * @returns {Object} Status information
         */
        return {
            session_name: this.sessionName,
            api_key: this.apiKey || null,
            webhook_running: this.webhookRunning,
            webhook_port: this.webhookPort,
            auth_method: this.apiKey ? 'API Key + Token Auth' : 'Token Auth Only',
            timestamp: new Date().toISOString()
        };
    }

    async refreshAuthentication() {
        /**
         * Refresh authentication tokens
         * 
         * @returns {Promise<boolean>} True if refresh successful, False otherwise
         */
        return await this._authenticate();
    }

    async startWebhookListener(port = 3000, callback = null, ngrokUrl = null) {
        /**
         * Start webhook server to receive incoming WhatsApp messages
         * 
         * @param {number} port - Port to run webhook server on
         * @param {Function} callback - Optional callback function for incoming messages
         * @param {string} ngrokUrl - Optional ngrok URL to configure server forwarding
         * @returns {Promise<boolean>} True if webhook server started successfully
         */
        if (this.webhookRunning) {
            console.log(chalk.yellow(`Webhook server already running on port ${this.webhookPort}`));
            return true;
        }

        // Configure server webhook forwarding if ngrok URL provided
        if (ngrokUrl) {
            await this._configureServerWebhook(ngrokUrl);
        }

        try {
            this.webhookPort = port;
            this.messageCallback = callback;

            // Create Express app for webhook
            this.webhookApp = express();
            this.webhookApp.use(express.json());

            // Add webhook route
            this.webhookApp.post('/webhook', (req, res) => {
                try {
                    const data = req.body;
                    if (data) {
                        this._processWebhook(data);
                    }
                    res.json({ status: 'ok' });
                } catch (error) {
                    console.log(chalk.red(`Webhook error: ${error.message}`));
                    res.status(500).json({ error: error.message });
                }
            });

            // Start webhook server
            this.webhookServer = this.webhookApp.listen(port, '0.0.0.0', () => {
                this.webhookRunning = true;
                console.log(chalk.green(`Webhook server started on port ${port}`));
                console.log(chalk.cyan(`Webhook URL: http://localhost:${port}/webhook`));
                if (ngrokUrl) {
                    console.log(chalk.magenta(`Public URL: ${ngrokUrl}/webhook`));
                }
            });

            return true;

        } catch (error) {
            console.log(chalk.red(`Failed to start webhook server: ${error.message}`));
            return false;
        }
    }

    stopWebhookListener() {
        /**
         * Stop the webhook server
         * 
         * @returns {boolean} True if stopped successfully
         */
        if (!this.webhookRunning) {
            console.log(chalk.yellow('Webhook server is not running'));
            return true;
        }

        try {
            if (this.webhookServer) {
                this.webhookServer.close();
            }
            this.webhookRunning = false;
            console.log(chalk.green('Webhook server stopped'));
            return true;
        } catch (error) {
            console.log(chalk.red(`Failed to stop webhook server: ${error.message}`));
            return false;
        }
    }

    _processWebhook(data) {
        /**
         * Process incoming webhook data
         * 
         * @param {Object} data - Webhook data from WhatsApp
         */
        try {
            // Extract message information
            const messageInfo = {
                from: data.from || 'unknown',
                body: data.body || data.text || data.message || 'N/A',
                type: data.type || 'text',
                timestamp: data.timestamp || Date.now(),
                session: data.session || this.sessionName,
                event: data.event || 'message'
            };

            // Store the message
            this.receivedMessages.push(messageInfo);

            // Display colored message in terminal
            console.log(chalk.green(`New WhatsApp Message #${this.receivedMessages.length}`));
            console.log(chalk.cyan(`Time: ${new Date().toLocaleTimeString()}`));
            console.log(chalk.yellow(`From: ${messageInfo.from}`));
            console.log(chalk.blue(`Type: ${messageInfo.type}`));
            console.log(chalk.white(`Message: ${messageInfo.body}`));
            console.log('─'.repeat(50));

            // Call custom callback if provided
            if (this.messageCallback) {
                this.messageCallback(messageInfo);
            }

        } catch (error) {
            console.log(chalk.red(`Error processing webhook: ${error.message}`));
        }
    }

    getReceivedMessages() {
        /**
         * Get all received messages
         * 
         * @returns {Array} List of received message objects
         */
        return [...this.receivedMessages];
    }

    clearReceivedMessages() {
        /**
         * Clear all received messages
         */
        this.receivedMessages = [];
        console.log(chalk.green('Received messages cleared'));
    }

    async listenForMessages(duration = 30) {
        /**
         * Listen for incoming messages for a specified duration
         * 
         * @param {number} duration - Time to listen in seconds
         */
        if (!this.webhookRunning) {
            console.log(chalk.red('Webhook server not running. Start it first with startWebhookListener()'));
            return;
        }

        console.log(chalk.green(`Listening for incoming messages for ${duration} seconds...`));
        console.log(chalk.cyan('Send messages to your WhatsApp to see them appear here'));

        const startTime = Date.now();
        const messageCount = this.receivedMessages.length;

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (Date.now() - startTime >= duration * 1000) {
                    clearInterval(interval);
                    console.log(chalk.green(`Listening completed. Received ${this.receivedMessages.length} total messages`));
                    resolve();
                }
            }, 1000);
        });
    }

    async _configureServerWebhook(ngrokUrl) {
        /**
         * Configure the main server to forward webhooks to ngrok URL
         * 
         * @param {string} ngrokUrl - The ngrok URL (without /webhook endpoint)
         */
        const webhookEndpoint = `${ngrokUrl}/webhook`;
        console.log(chalk.blue(`Configuring server to forward webhooks to: ${webhookEndpoint}`));

        try {
            const response = await axios.post(
                `${this.serverUrl}/api/webhook/configure`,
                { webhookUrl: webhookEndpoint },
                { timeout: 10000 }
            );

            if (response.status === 200) {
                console.log(chalk.green('Server webhook configuration successful!'));
            } else {
                console.log(chalk.yellow(`Server config response: ${response.status}`));
            }
        } catch (error) {
            console.log(chalk.yellow(`Server configuration note: ${error.message}`));
        }
    }
}

module.exports = WhatsAppClient;