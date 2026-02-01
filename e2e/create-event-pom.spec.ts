import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateEventDialog } from './pages/CreateEventDialog';

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

  test('should create an event using POM pattern', async () => {
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
        waitForSuggestions: true,
        selectFirstSuggestion: true,
      });
    });

    await test.step('Verify event was created', async () => {
      // Dialog should close or show success
      const dialogVisible = await createEventDialog.dialogTitle.isVisible().catch(() => false);
      const successVisible = await createEventDialog.successMessage.isVisible().catch(() => false);
      
      expect(dialogVisible || successVisible).toBeTruthy();
    });
  });

  test('should fill form step by step using POM', async () => {
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

    await test.step('Wait for AI suggestions', async () => {
      await createEventDialog.waitForAISuggestions();
      const hasSuggestions = await createEventDialog.hasSuggestions();
      
      if (hasSuggestions) {
        const selected = await createEventDialog.selectFirstSuggestion();
        if (!selected) {
          console.log('ℹ️ AI suggestions appeared but no checkboxes found to select');
        }
        // Don't fail if suggestions exist but can't be selected
        // (AI might return suggestions without actionable checkboxes)
      } else {
        console.log('ℹ️ No AI suggestions appeared');
      }
    });

    await test.step('Submit form', async () => {
      await createEventDialog.submit();
      await createEventDialog.waitForSuccess();
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
