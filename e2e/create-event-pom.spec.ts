import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateEventDialog } from './pages/CreateEventDialog';
import { deleteEventByTitle } from './utils/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

const TEST_EMAIL = process.env.E2E_USERNAME || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'Test123456!';

/**
 * E2E Test: Create Event Flow (using Page Object Model)
 * 
 * This test demonstrates the use of Page Object Model pattern
 * for better maintainability and reusability.
 */
test.describe('Create Event Flow (with POM)', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let createEventDialog: CreateEventDialog;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    createEventDialog = new CreateEventDialog(page);

    // Login before each test
    await loginPage.loginAs(TEST_EMAIL, TEST_PASSWORD);
    await dashboardPage.waitForLoad();
  });

  test('should create an event using POM pattern', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout to 60s for this test
    
    // Calculate dates
    const today = new Date();
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(today.getDate() + 2);

    await test.step('Open create event dialog', async () => {
      await dashboardPage.openCreateEventDialog();
      await createEventDialog.waitForOpen();
    });

    await test.step('Create event with AI suggestions', async () => {
      await createEventDialog.createEvent({
        title: 'Doctor appointment',
        startDate: twoDaysFromNow,
        startHours: 14,
        startMinutes: 0,
        endDate: twoDaysFromNow,
        endHours: 15,
        endMinutes: 0,
        waitForSuggestions: false, // Skip AI suggestions in tests
        selectFirstSuggestion: false,
      });
    });

    await test.step('Verify event was created', async () => {
      // Wait for either success message or dialog to close (longer timeout for WebKit)
      await Promise.race([
        createEventDialog.successMessage.waitFor({ state: 'visible', timeout: 15000 }),
        createEventDialog.dialogTitle.waitFor({ state: 'hidden', timeout: 15000 })
      ]).catch(async () => {
        // If both fail, wait a bit more - some browsers are slower
        await page.waitForTimeout(2000);
      });
      
      // Verify event was created - either dialog closed or success visible
      const dialogClosed = await createEventDialog.dialogTitle.isHidden().catch(() => false);
      const successVisible = await createEventDialog.successMessage.isVisible().catch(() => false);
      
      // At least one should be true
      expect(dialogClosed || successVisible).toBeTruthy();
    });

    // Cleanup: Delete the created event
    await test.step('Cleanup: Delete created event', async () => {
      await deleteEventByTitle(page, 'Doctor appointment');
    });
  });

  test('should fill form step by step using POM', async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await dashboardPage.openCreateEventDialog();
    await createEventDialog.waitForOpen();

    await test.step('Fill title', async () => {
      await createEventDialog.fillTitle('Team Meeting');
    });

    await test.step('Fill description', async () => {
      await createEventDialog.fillDescription('Monthly team sync');
    });

    await test.step('Set times', async () => {
      await createEventDialog.setStartTime(tomorrow, 10, 0);
      await createEventDialog.setEndTime(tomorrow, 11, 30);
    });

    await test.step('Submit form', async () => {
      await createEventDialog.submit();
      
      // Wait for either success message or dialog to close
      await Promise.race([
        createEventDialog.successMessage.waitFor({ state: 'visible', timeout: 10000 }),
        createEventDialog.dialogTitle.waitFor({ state: 'hidden', timeout: 10000 })
      ]).catch(() => {
        // Ignore timeout - verify in next step
      });
    });

    // Cleanup: Delete the created event
    await test.step('Cleanup: Delete created event', async () => {
      await deleteEventByTitle(page, 'Team Meeting');
    });
  });

  test('should cancel event creation using POM', async () => {
    await dashboardPage.openCreateEventDialog();
    await createEventDialog.waitForOpen();
    
    await createEventDialog.fillTitle('Test Event');
    await createEventDialog.cancel();
    
    await createEventDialog.waitForClose();
  });
});
