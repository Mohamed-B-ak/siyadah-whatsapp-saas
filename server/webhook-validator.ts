/**
 * Webhook Validation and Resilience System
 * Ensures webhook URLs are valid and handles failures gracefully
 */
import axios from 'axios';

interface WebhookRetryState {
  failures: number;
  lastFailure: Date;
  isActive: boolean;
  totalCalls: number;
  successfulCalls: number;
}

class WebhookValidator {
  private retryStates: Map<string, WebhookRetryState> = new Map();
  private readonly MAX_FAILURES = 5;
  private readonly RETRY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  
  validateWebhookUrl(url: string): { isValid: boolean; error?: string } {
    if (!url || url.trim().length === 0) {
      return { isValid: false, error: 'Webhook URL cannot be empty' };
    }

    try {
      const parsedUrl = new URL(url);
      
      // Must be HTTP or HTTPS
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { isValid: false, error: 'Webhook URL must use HTTP or HTTPS protocol' };
      }
      
      // Must have a valid hostname
      if (!parsedUrl.hostname || parsedUrl.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
        return { isValid: false, error: 'Invalid hostname for production webhook' };
      }
      
      // Check for common invalid patterns
      const invalidPatterns = [
        '127.0.0.1',
        '0.0.0.0',
        '192.168.',
        '10.0.0.',
        'example.com',
        'test.com'
      ];
      
      if (process.env.NODE_ENV === 'production' && invalidPatterns.some(pattern => url.includes(pattern))) {
        return { isValid: false, error: 'Webhook URL appears to be a test/local address' };
      }
      
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  getWebhookState(webhookUrl: string): WebhookRetryState {
    if (!this.retryStates.has(webhookUrl)) {
      this.retryStates.set(webhookUrl, {
        failures: 0,
        lastFailure: new Date(0),
        isActive: true,
        totalCalls: 0,
        successfulCalls: 0
      });
    }
    return this.retryStates.get(webhookUrl)!;
  }

  isWebhookActive(webhookUrl: string): boolean {
    const state = this.getWebhookState(webhookUrl);
    
    // If we haven't hit the failure limit, it's active
    if (state.failures < this.MAX_FAILURES) {
      return true;
    }
    
    // If we've hit the limit, check if timeout has passed
    const timeSinceLastFailure = Date.now() - state.lastFailure.getTime();
    if (timeSinceLastFailure > this.RETRY_TIMEOUT) {
      // Reset failures and try again
      state.failures = 0;
      state.isActive = true;
      console.log(`[WEBHOOK] Reactivating webhook after timeout: ${webhookUrl}`);
    }
    
    return state.isActive;
  }

  async callWebhook(webhookUrl: string, data: any, token?: string): Promise<{ success: boolean; error?: string }> {
    const validation = this.validateWebhookUrl(webhookUrl);
    if (!validation.isValid) {
      return { success: false, error: `Invalid webhook URL: ${validation.error}` };
    }

    if (!this.isWebhookActive(webhookUrl)) {
      return { success: false, error: 'Webhook is temporarily disabled due to repeated failures' };
    }

    const state = this.getWebhookState(webhookUrl);
    state.totalCalls++;

    try {
      const headers: any = {
        'Content-Type': 'application/json',
        'User-Agent': 'Siyadah-WhatsApp-Bridge/1.0'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Webhook-Token'] = token;
      }

      const response = await axios.post(webhookUrl, data, {
        headers,
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      if (response.status >= 200 && response.status < 300) {
        // Success
        state.successfulCalls++;
        if (state.failures > 0) {
          console.log(`[WEBHOOK] Webhook recovered: ${webhookUrl} (${state.failures} previous failures)`);
          state.failures = 0; // Reset failures on success
        }
        return { success: true };
      } else {
        // Client error (4xx) - don't count as failure, just log
        console.warn(`[WEBHOOK] Client error ${response.status} for ${webhookUrl}:`, response.statusText);
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

    } catch (error: any) {
      // Network or server error - count as failure
      state.failures++;
      state.lastFailure = new Date();
      
      if (state.failures >= this.MAX_FAILURES) {
        state.isActive = false;
        console.error(`[WEBHOOK] Disabling webhook after ${this.MAX_FAILURES} failures: ${webhookUrl}`);
      }

      const errorMessage = error.response ? 
        `HTTP ${error.response.status}: ${error.response.statusText}` :
        error.message || 'Network error';

      console.error(`[WEBHOOK] Failure ${state.failures}/${this.MAX_FAILURES} for ${webhookUrl}: ${errorMessage}`);
      
      return { success: false, error: errorMessage };
    }
  }

  getWebhookStats(webhookUrl: string) {
    const state = this.getWebhookState(webhookUrl);
    return {
      totalCalls: state.totalCalls,
      successfulCalls: state.successfulCalls,
      failures: state.failures,
      successRate: state.totalCalls > 0 ? (state.successfulCalls / state.totalCalls * 100).toFixed(2) : '0.00',
      isActive: state.isActive,
      lastFailure: state.lastFailure
    };
  }
}

export const webhookValidator = new WebhookValidator();