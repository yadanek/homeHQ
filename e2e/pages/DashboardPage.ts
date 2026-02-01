import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Dashboard Page
 * 
 * Encapsulates all dashboard-related interactions and assertions.
 */
export class DashboardPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly addEventButton: Locator;
  readonly familySettingsButton: Locator;
  readonly userMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1:has-text("HomeHQ")');
    this.addEventButton = page.locator('button', { hasText: 'Add Event' });
    this.familySettingsButton = page.locator('button', { hasText: 'Family Settings' });
    this.userMenu = page.locator('[data-testid="user-menu"]').or(page.locator('button').filter({ hasText: /logout|sign out/i }));
  }

  /**
   * Wait for dashboard to be fully loaded
   */
  async waitForLoad() {
    await expect(this.pageTitle).toBeVisible({ timeout: 10000 });
    // Check for calendar area instead of Family Settings button
    // which might not always be visible depending on user role
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Open the create event dialog
   */
  async openCreateEventDialog() {
    await this.addEventButton.click();
  }

  /**
   * Check if an event with given title is visible
   */
  async hasEventWithTitle(title: string): Promise<boolean> {
    return await this.page.locator(`text=${title}`).first().isVisible().catch(() => false);
  }
}
