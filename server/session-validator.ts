/**
 * Session Name Validation for Filesystem Compatibility
 * Ensures session names work reliably across platforms
 */

export class SessionValidator {
  private static readonly MAX_SESSION_LENGTH = 80; // Safe for most filesystems
  private static readonly ALLOWED_PATTERN = /^[a-zA-Z0-9_-]+$/;
  private static readonly RESERVED_NAMES = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'lpt1', 'lpt2'];

  static validateSessionName(sessionName: string): { isValid: boolean; error?: string; sanitized?: string } {
    if (!sessionName || sessionName.length === 0) {
      return { isValid: false, error: 'Session name cannot be empty' };
    }

    // Check length
    if (sessionName.length > this.MAX_SESSION_LENGTH) {
      return { 
        isValid: false, 
        error: `Session name too long (max ${this.MAX_SESSION_LENGTH} characters)` 
      };
    }

    // Check for double underscores (causes parsing issues)
    if (sessionName.includes('__')) {
      return { 
        isValid: false, 
        error: 'Session name cannot contain double underscores (__)' 
      };
    }

    // Check for reserved names (Windows compatibility)
    const lowerName = sessionName.toLowerCase();
    if (this.RESERVED_NAMES.includes(lowerName)) {
      return { 
        isValid: false, 
        error: `Session name '${sessionName}' is reserved and cannot be used` 
      };
    }

    // Sanitize the session name
    const sanitized = this.sanitizeSessionName(sessionName);
    
    if (sanitized !== sessionName) {
      return {
        isValid: false,
        error: 'Session name contains invalid characters',
        sanitized
      };
    }

    return { isValid: true, sanitized: sessionName };
  }

  static sanitizeSessionName(sessionName: string): string {
    return sessionName
      // Remove invalid characters
      .replace(/[^a-zA-Z0-9_-]/g, '')
      // Replace multiple underscores with single
      .replace(/_{2,}/g, '_')
      // Remove leading/trailing underscores and hyphens
      .replace(/^[_-]+|[_-]+$/g, '')
      // Ensure it starts with alphanumeric
      .replace(/^[^a-zA-Z0-9]/, 'session_')
      // Limit length
      .substring(0, this.MAX_SESSION_LENGTH);
  }

  static buildFullSessionId(companyId: string, sessionName: string): string {
    const validation = this.validateSessionName(sessionName);
    const finalSessionName = validation.isValid ? sessionName : validation.sanitized || 'invalid_session';
    
    return `${companyId}_${finalSessionName}`;
  }

  static parseSessionId(fullSessionId: string): { companyId: string; sessionName: string } {
    const parts = fullSessionId.split('_');
    if (parts.length < 2) {
      return { companyId: 'unknown', sessionName: fullSessionId };
    }
    
    const companyId = parts[0];
    const sessionName = parts.slice(1).join('_');
    
    return { companyId, sessionName };
  }
}