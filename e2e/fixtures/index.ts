/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { CreateEventDialog } from '../pages/CreateEventDialog';
import { TestCredentials } from '../utils/helpers';

/**
 * Custom Fixtures for E2E Tests
 * 
 * Extends Playwright's base test with custom fixtures that
 * automatically initialize page objects and handle authentication.
 * 
 * Usage:
 * ```typescript
 * import { test } from './fixtures';
 * 
 * test('my test', async ({ authenticatedPage, dashboardPage }) => {
 *   // Page is already logged in and on dashboard
 *   await dashboardPage.openCreateEventDialog();
 * });
 * ```
 */

type TestFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  createEventDialog: CreateEventDialog;
  authenticatedPage: void; // Special fixture that performs login
};

export const test = base.extend<TestFixtures>({
  /**
   * LoginPage fixture
   */
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  /**
   * DashboardPage fixture
   */
  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  /**
   * CreateEventDialog fixture
   */
  createEventDialog: async ({ page }, use) => {
    const createEventDialog = new CreateEventDialog(page);
    await use(createEventDialog);
  },

  /**
   * Authenticated page fixture
   * Automatically logs in the test user before the test
   */
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    
    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login
    await loginPage.login(TestCredentials.email, TestCredentials.password);
    await loginPage.waitForDashboard();
    
    // Wait for dashboard to be fully ready
    await dashboardPage.waitForLoad();

    // Test can now use the authenticated page
    await use();

    // Cleanup after test (optional)
    // Could add logout logic here if needed
  },
});

export { expect } from '@playwright/test';
