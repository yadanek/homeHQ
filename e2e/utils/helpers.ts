/**
 * Test Utilities and Helper Functions
 * 
 * Common utilities used across E2E tests
 */

/**
 * Format date for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export function formatDateTimeLocal(date: Date, hours?: number, minutes?: number): string {
  const d = new Date(date);
  
  if (hours !== undefined) {
    d.setHours(hours);
  }
  if (minutes !== undefined) {
    d.setMinutes(minutes);
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Get date N days from now
 */
export function getDaysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Get date N days ago
 */
export function getDaysAgo(days: number): Date {
  return getDaysFromNow(-days);
}

/**
 * Format date for display (e.g., "January 15, 2026")
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format time for display (e.g., "2:00 PM")
 */
export function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 100,
    errorMessage = 'Condition not met within timeout'
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(errorMessage);
}

/**
 * Generate random string for unique identifiers
 */
export function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}+${randomString()}@example.com`;
}

/**
 * Test data generators
 */
export const TestData = {
  event: {
    title: (suffix?: string) => `Test Event${suffix ? ` ${suffix}` : ` ${randomString(4)}`}`,
    description: (suffix?: string) => `Test event description${suffix ? ` ${suffix}` : ''}`,
  },
  task: {
    title: (suffix?: string) => `Test Task${suffix ? ` ${suffix}` : ` ${randomString(4)}`}`,
    description: (suffix?: string) => `Test task description${suffix ? ` ${suffix}` : ''}`,
  },
  family: {
    name: (suffix?: string) => `Test Family${suffix ? ` ${suffix}` : ` ${randomString(4)}`}`,
  },
  member: {
    name: (suffix?: string) => `Test Member${suffix ? ` ${suffix}` : ` ${randomString(4)}`}`,
  }
};

/**
 * Common test credentials (should match .env.test)
 */
export const TestCredentials = {
  email: process.env.E2E_USERNAME || 'test@example.com',
  password: process.env.E2E_PASSWORD || 'Test123456!',
  userId: process.env.E2E_USERNAME_ID || '',
};

/**
 * Common timeouts
 */
export const Timeouts = {
  SHORT: 2000,
  MEDIUM: 5000,
  LONG: 10000,
  VERY_LONG: 30000,
};

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, onRetry } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}
