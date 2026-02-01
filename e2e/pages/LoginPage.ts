import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Login Page
 * 
 * Encapsulates all login-related interactions and assertions.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.loginButton = page.locator('button:has-text("Zaloguj się")');
    this.errorMessage = page.locator('[role="alert"]');
  }

  /**
   * Navigate to the application
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Perform login with provided credentials
   */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /**
   * Wait for successful login (dashboard appears)
   */
  async waitForDashboard() {
    await expect(this.page.locator('h1:has-text("HomeHQ")')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Complete login flow: goto -> login -> wait for dashboard
   */
  async loginAs(email: string, password: string) {
    await this.goto();
    await this.login(email, password);
    await this.waitForDashboard();
  }
}
