/**
 * Session Status Management for QR Code Polling
 * Provides clear status tracking for frontend polling
 */

export enum SessionStatus {
  INITIALIZING = 'initializing',      // Session being created
  QRCODE = 'qrcode',                 // QR code ready for scanning
  QR_PENDING = 'qr_pending',         // Waiting for user to scan QR
  CONNECTING = 'connecting',          // User scanned, connecting to WhatsApp
  CONNECTED = 'connected',           // Successfully connected
  DISCONNECTED = 'disconnected',     // Connection lost
  RECONNECTING = 'reconnecting',     // Attempting to reconnect
  ERROR = 'error',                   // Error state
  TIMEOUT = 'timeout'                // Session timed out
}

export interface SessionStatusResponse {
  success: boolean;
  status: SessionStatus;
  qrCode?: string;
  qrCodeUpdatedAt?: Date;
  message?: string;
  canRetry?: boolean;
  retryAfter?: number;
}

export class SessionStatusManager {
  
  static getHumanReadableStatus(status: SessionStatus): string {
    switch (status) {
      case SessionStatus.INITIALIZING:
        return 'Starting session...';
      case SessionStatus.QRCODE:
        return 'QR code ready - scan with WhatsApp';
      case SessionStatus.QR_PENDING:
        return 'Waiting for QR code scan';
      case SessionStatus.CONNECTING:
        return 'Connecting to WhatsApp...';
      case SessionStatus.CONNECTED:
        return 'Connected and ready';
      case SessionStatus.DISCONNECTED:
        return 'Disconnected from WhatsApp';
      case SessionStatus.RECONNECTING:
        return 'Reconnecting...';
      case SessionStatus.ERROR:
        return 'Connection error occurred';
      case SessionStatus.TIMEOUT:
        return 'Session timed out';
      default:
        return 'Unknown status';
    }
  }

  static shouldAllowPolling(status: SessionStatus): boolean {
    // Allow polling for these statuses
    return [
      SessionStatus.INITIALIZING,
      SessionStatus.QR_PENDING,
      SessionStatus.CONNECTING,
      SessionStatus.RECONNECTING
    ].includes(status);
  }

  static isTerminalStatus(status: SessionStatus): boolean {
    // These statuses don't change without user action
    return [
      SessionStatus.CONNECTED,
      SessionStatus.ERROR,
      SessionStatus.TIMEOUT
    ].includes(status);
  }

  static getPollingInterval(status: SessionStatus): number {
    // Return polling interval in milliseconds
    switch (status) {
      case SessionStatus.INITIALIZING:
        return 2000; // Check every 2 seconds during initialization
      case SessionStatus.QR_PENDING:
        return 3000; // Check every 3 seconds while waiting for scan
      case SessionStatus.CONNECTING:
        return 1000; // Check every second during connection
      case SessionStatus.RECONNECTING:
        return 5000; // Check every 5 seconds during reconnection
      default:
        return 10000; // Default 10 seconds for other states
    }
  }

  static createStatusResponse(
    status: SessionStatus,
    qrCode?: string,
    qrCodeUpdatedAt?: Date,
    message?: string
  ): SessionStatusResponse {
    return {
      success: true,
      status,
      qrCode,
      qrCodeUpdatedAt,
      message: message || this.getHumanReadableStatus(status),
      canRetry: !this.isTerminalStatus(status),
      retryAfter: this.getPollingInterval(status)
    };
  }
}