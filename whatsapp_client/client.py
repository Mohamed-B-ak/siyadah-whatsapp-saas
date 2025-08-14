"""
WhatsApp Client - Simple Library
Easy-to-use WhatsApp messaging client with working authentication
"""

import requests
import time
import threading
import json
from datetime import datetime
from typing import List, Dict, Optional, Callable
from flask import Flask, request, jsonify
from colorama import init, Fore, Style

# Initialize colorama for colored terminal output
init()


class WhatsAppClient:

    def __init__(self,
                 session_name: str = "mohamed_session",
                 server_url: str = None,
                 api_key: str = None):
        """
        Initialize WhatsApp client

        Args:
            session_name: Name of the WhatsApp session
            server_url: Server URL (optional, uses default if not provided)
            api_key: Master API Key (for identification purposes, still requires token auth)
        """
        self.session_name = session_name
        self.server_url = server_url or "https://3e0f14cc-731c-4c72-96e7-feb806c5128b-00-39cvzl2tdyxjo.sisko.replit.dev"
        self.api_key = api_key
        self.secret_key = None
        self.auth_token = None
        self.authenticated = False

        # Webhook functionality
        self.webhook_app = None
        self.webhook_thread = None
        self.webhook_port = None
        self.webhook_running = False
        self.message_callback = None
        self.received_messages = []

        # Always authenticate with token generation
        self._authenticate()

    def _authenticate(self) -> bool:
        """Internal authentication method"""
        try:
            # Get secret key
            response = requests.get(f"{self.server_url}/api/secret-key",
                                    timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.secret_key = data.get('secretKey', '')
            else:
                return False

            # Generate auth token
            response = requests.post(
                f"{self.server_url}/api/{self.session_name}/{self.secret_key}/generate-token",
                timeout=10)
            if response.status_code == 201:
                data = response.json()
                self.auth_token = data.get('full', '')
                self.authenticated = True
                return True

            return False
        except Exception:
            return False

    def is_connected(self) -> bool:
        """
        Check if WhatsApp session is connected

        Returns:
            bool: True if connected, False otherwise
        """
        if not self.authenticated:
            return False

        try:
            response = requests.get(
                f"{self.server_url}/api/{self.session_name}/check-connection-session",
                headers={'Authorization': f'Bearer {self.auth_token}'},
                timeout=10)

            if response.status_code == 200:
                data = response.json()
                return data.get('status') == 'CONNECTED'
            return False
        except:
            return False

    def send_message(self, phone: str, message: str) -> bool:
        """
        Send a WhatsApp message

        Args:
            phone: Phone number (e.g., "21653844063")
            message: Message text to send

        Returns:
            bool: True if message sent successfully, False otherwise
        """
        if not self.authenticated:
            if not self._authenticate():
                return False

        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.auth_token}'
            }

            payload = {'phone': phone, 'message': message}

            response = requests.post(
                f"{self.server_url}/api/{self.session_name}/send-message",
                json=payload,
                headers=headers,
                timeout=30)

            return response.status_code in [200, 201]

        except Exception:
            if self._authenticate():
                try:
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {self.auth_token}'
                    }
                    payload = {'phone': phone, 'message': message}
                    response = requests.post(
                        f"{self.server_url}/api/{self.session_name}/send-message",
                        json=payload,
                        headers=headers,
                        timeout=30)
                    return response.status_code in [200, 201]
                except:
                    return False
            return False

    def send_bulk_messages(self,
                           recipients: List[Dict],
                           delay: int = 2) -> Dict:
        """
        Send messages to multiple recipients

        Args:
            recipients: List of dicts with 'phone' and 'message' keys
            delay: Delay between messages in seconds

        Returns:
            dict: Results summary
        """
        results = {'sent': 0, 'failed': 0, 'details': []}

        for recipient in recipients:
            phone = recipient.get('phone')
            message = recipient.get('message')

            if not phone or not message:
                results['failed'] += 1
                results['details'].append({
                    'phone': phone,
                    'status': 'failed',
                    'error': 'Missing phone or message'
                })
                continue

            success = self.send_message(phone, message)
            if success:
                results['sent'] += 1
                results['details'].append({'phone': phone, 'status': 'sent'})
            else:
                results['failed'] += 1
                results['details'].append({'phone': phone, 'status': 'failed'})

            if delay > 0:
                time.sleep(delay)

        return results

    def get_status(self) -> Dict:
        """
        Get detailed status information

        Returns:
            dict: Status information
        """
        return {
            'session_name': self.session_name,
            'api_key': self.api_key if self.api_key else None,
            'webhook_running': self.webhook_running,
            'webhook_port': self.webhook_port,
            'auth_method':
            'API Key + Token Auth' if self.api_key else 'Token Auth Only',
            'timestamp': datetime.now().isoformat()
        }

    def refresh_authentication(self) -> bool:
        """
        Refresh authentication tokens

        Returns:
            bool: True if refresh successful, False otherwise
        """
        return self._authenticate()

    def start_webhook_listener(self,
                               port: int = 3000,
                               callback: Callable = None,
                               ngrok_url: str = None) -> bool:
        """
        Start webhook server to receive incoming WhatsApp messages

        Args:
            port: Port to run webhook server on
            callback: Optional callback function for incoming messages
            ngrok_url: Optional ngrok URL to configure server forwarding

        Returns:
            bool: True if webhook server started successfully
        """
        if self.webhook_running:
            print(
                f"{Fore.YELLOW}Webhook server already running on port {self.webhook_port}{Style.RESET_ALL}"
            )
            return True

        # Configure server webhook forwarding if ngrok URL provided
        if ngrok_url:
            self._configure_server_webhook(ngrok_url)

        try:
            self.webhook_port = port
            self.message_callback = callback

            # Create Flask app for webhook
            self.webhook_app = Flask(__name__)
            self.webhook_app.logger.disabled = True

            # Add webhook route
            @self.webhook_app.route('/webhook', methods=['POST'])
            def handle_webhook():
                try:
                    data = request.get_json()
                    if data:
                        self._process_webhook(data)
                    return jsonify({'status': 'ok'})
                except Exception as e:
                    print(
                        f"{Fore.RED}Webhook error: {str(e)}{Style.RESET_ALL}")
                    return jsonify({'error': str(e)}), 500

            # Start webhook server in background thread
            def run_webhook():
                self.webhook_app.run(host='0.0.0.0',
                                     port=port,
                                     debug=False,
                                     use_reloader=False)

            self.webhook_thread = threading.Thread(target=run_webhook,
                                                   daemon=True)
            self.webhook_thread.start()
            self.webhook_running = True

            print(
                f"{Fore.GREEN}Webhook server started on port {port}{Style.RESET_ALL}"
            )
            print(
                f"{Fore.CYAN}Webhook URL: http://localhost:{port}/webhook{Style.RESET_ALL}"
            )
            if ngrok_url:
                print(
                    f"{Fore.MAGENTA}Public URL: {ngrok_url}/webhook{Style.RESET_ALL}"
                )
            return True

        except Exception as e:
            print(
                f"{Fore.RED}Failed to start webhook server: {str(e)}{Style.RESET_ALL}"
            )
            return False

    def stop_webhook_listener(self) -> bool:
        """
        Stop the webhook server

        Returns:
            bool: True if stopped successfully
        """
        if not self.webhook_running:
            print(
                f"{Fore.YELLOW}Webhook server is not running{Style.RESET_ALL}")
            return True

        try:
            self.webhook_running = False
            print(f"{Fore.GREEN}Webhook server stopped{Style.RESET_ALL}")
            return True
        except Exception as e:
            print(
                f"{Fore.RED}Failed to stop webhook server: {str(e)}{Style.RESET_ALL}"
            )
            return False

    def _process_webhook(self, data: Dict) -> None:
        """
        Process incoming webhook data

        Args:
            data: Webhook data from WhatsApp
        """
        try:
            # Extract message information
            message_info = {
                'from': data.get('from', 'unknown'),
                'body': data.get('body', data.get('text', 'N/A')),
                'type': data.get('type', 'text'),
                'timestamp': data.get('timestamp', time.time()),
                'session': data.get('session', self.session_name),
                'event': data.get('event', 'message')
            }

            # Store the message
            self.received_messages.append(message_info)

            # Display colored message in terminal
            print(
                f"{Fore.GREEN}New WhatsApp Message #{len(self.received_messages)}{Style.RESET_ALL}"
            )
            print(
                f"{Fore.CYAN}Time: {time.strftime('%H:%M:%S')}{Style.RESET_ALL}"
            )
            print(
                f"{Fore.YELLOW}From: {message_info['from']}{Style.RESET_ALL}")
            print(f"{Fore.BLUE}Type: {message_info['type']}{Style.RESET_ALL}")
            print(
                f"{Fore.WHITE}Message: {message_info['body']}{Style.RESET_ALL}"
            )
            print("─" * 50)

            # Call custom callback if provided
            if self.message_callback:
                self.message_callback(message_info)

        except Exception as e:
            print(
                f"{Fore.RED}Error processing webhook: {str(e)}{Style.RESET_ALL}"
            )

    def get_received_messages(self) -> List[Dict]:
        """
        Get all received messages

        Returns:
            list: List of received message dictionaries
        """
        return self.received_messages.copy()

    def clear_received_messages(self) -> None:
        """
        Clear all received messages
        """
        self.received_messages.clear()
        print(f"{Fore.GREEN}Received messages cleared{Style.RESET_ALL}")

    def listen_for_messages(self, duration: int = 30) -> None:
        """
        Listen for incoming messages for a specified duration

        Args:
            duration: Time to listen in seconds
        """
        if not self.webhook_running:
            print(
                f"{Fore.RED}Webhook server not running. Start it first with start_webhook_listener(){Style.RESET_ALL}"
            )
            return

        print(
            f"{Fore.GREEN}Listening for incoming messages for {duration} seconds...{Style.RESET_ALL}"
        )
        print(
            f"{Fore.CYAN}Send messages to your WhatsApp to see them appear here{Style.RESET_ALL}"
        )

        start_time = time.time()
        message_count = len(self.received_messages)

        try:
            while time.time() - start_time < duration:
                time.sleep(1)
                new_count = len(self.received_messages)
                if new_count > message_count:
                    message_count = new_count

            print(
                f"{Fore.GREEN}Listening completed. Received {len(self.received_messages)} total messages{Style.RESET_ALL}"
            )

        except KeyboardInterrupt:
            print(f"{Fore.YELLOW}Listening stopped by user{Style.RESET_ALL}")

    def _configure_server_webhook(self, ngrok_url: str) -> None:
        """
        Configure the main server to forward webhooks to ngrok URL

        Args:
            ngrok_url: The ngrok URL (without /webhook endpoint)
        """
        webhook_endpoint = f"{ngrok_url}/webhook"
        print(
            f"{Fore.BLUE}Configuring server to forward webhooks to: {webhook_endpoint}{Style.RESET_ALL}"
        )

        try:
            response = requests.post(
                f"{self.server_url}/api/webhook/configure",
                json={"webhookUrl": webhook_endpoint},
                timeout=10)
            if response.status_code == 200:
                print(
                    f"{Fore.GREEN}Server webhook configuration successful!{Style.RESET_ALL}"
                )
            else:
                print(
                    f"{Fore.YELLOW}Server config response: {response.status_code}{Style.RESET_ALL}"
                )
        except Exception as e:
            print(
                f"{Fore.YELLOW}Server configuration note: {str(e)}{Style.RESET_ALL}"
            )
