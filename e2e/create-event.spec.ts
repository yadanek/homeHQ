import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

const TEST_EMAIL = process.env.E2E_USERNAME || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'Test123456!';

// Debug: Log loaded credentials
console.log('🔍 E2E Test Config:');
console.log('  .env.test path:', path.resolve(__dirname, '..', '.env.test'));
console.log('  TEST_EMAIL:', TEST_EMAIL);
console.log('  TEST_PASSWORD:', TEST_PASSWORD ? '***' + TEST_PASSWORD.slice(-3) : 'NOT SET');

/**
 * E2E Test: Create Event Flow
 * 
 * Test scenario:
 * 1. User logs in to the application
 * 2. Navigates to dashboard (calendar view)
 * 3. Clicks the add event button
 * 4. Fills in the event creation form
 * 5. Waits for AI task suggestions
 * 6. Selects a suggested task
 * 7. Submits the form
 * 8. Verifies the event was created successfully
 */
test.describe('Create Event Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should create an event with AI task suggestions', async ({ page }) => {
    // Step 1: Login
    await test.step('Login to the application', async () => {
      // Wait for login form to be visible
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible({ timeout: 10000 });

      // Fill in credentials
      await emailInput.fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);

      // Click login button (contains "Zaloguj się" text)
      const loginButton = page.locator('button:has-text("Zaloguj się")');
      await loginButton.click();

      // Wait for dashboard to load - check for calendar or dashboard title
      await expect(page.locator('h1:has-text("HomeHQ")')).toBeVisible({ timeout: 10000 });
    });

    // Step 2: Wait for dashboard to fully load
    await test.step('Wait for dashboard to load', async () => {
      // Wait for "Family Settings" button to ensure dashboard is ready
      await expect(page.locator('button:has-text("Family Settings")')).toBeVisible({ timeout: 5000 });
    });

    // Step 3: Open create event dialog
    await test.step('Open create event dialog', async () => {
      // Click "Add Event" button (from CalendarControls)
      const addEventButton = page.locator('button:has-text("Add Event")');
      await expect(addEventButton).toBeVisible({ timeout: 5000 });
      await addEventButton.click();

      // Wait for dialog to open (check for dialog title)
      const dialogTitle = page.locator('h2:has-text("Create New Event")');
      await expect(dialogTitle).toBeVisible({ timeout: 5000 });
    });

    // Step 4: Fill in event details
    await test.step('Fill in event form', async () => {
      // Fill in title
      const titleInput = page.locator('input#title');
      await titleInput.fill('Doctor appointment');
      await expect(titleInput).toHaveValue('Doctor appointment');

      // Calculate dates: 2 days from now
      const today = new Date();
      const twoDaysFromNow = new Date(today);
      twoDaysFromNow.setDate(today.getDate() + 2);
      
      // Format for datetime-local input: YYYY-MM-DDTHH:mm
      const formatDateTimeLocal = (date: Date, hours: number, minutes: number) => {
        const d = new Date(date);
        d.setHours(hours, minutes, 0, 0);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
      };

      const startDateTime = formatDateTimeLocal(twoDaysFromNow, 14, 0); // 14:00
      const endDateTime = formatDateTimeLocal(twoDaysFromNow, 15, 0);   // 15:00

      // Fill in start time
      const startTimeInput = page.locator('input#startTime');
      await startTimeInput.fill(startDateTime);
      await expect(startTimeInput).toHaveValue(startDateTime);

      // Fill in end time
      const endTimeInput = page.locator('input#endTime');
      await endTimeInput.fill(endDateTime);
      await expect(endTimeInput).toHaveValue(endDateTime);
    });

    // Step 5: Wait for AI suggestions
    await test.step('Wait for AI task suggestions', async () => {
      // Wait for suggestions to load (max 2 seconds as per requirements)
      // First, check if loading indicator appears
      const loadingIndicator = page.locator('text=Analyzing event...');
      
      // Wait a bit for the debounce to trigger (500ms debounce in code)
      await page.waitForTimeout(600);
      
      // Wait for either suggestions to appear or loading to complete
      await Promise.race([
        page.locator('text=AI Task Suggestions').waitFor({ timeout: 2000 }).catch(() => null),
        page.waitForTimeout(2000)
      ]);

      // Check if suggestions section is visible
      const suggestionsSection = page.locator('h3:has-text("AI Task Suggestions")');
      const hasSuggestions = await suggestionsSection.isVisible().catch(() => false);
      
      if (hasSuggestions) {
        console.log('✅ AI suggestions loaded');
      } else {
        console.log('ℹ️ No AI suggestions appeared (this may be expected)');
      }
    });

    // Step 6: Select first suggestion if available
    await test.step('Select first AI suggestion if available', async () => {
      // Look for checkboxes in suggestions
      const firstSuggestionCheckbox = page.locator('input[type="checkbox"][id^="suggestion-"]').first();
      const checkboxExists = await firstSuggestionCheckbox.isVisible().catch(() => false);
      
      if (checkboxExists) {
        await firstSuggestionCheckbox.check();
        await expect(firstSuggestionCheckbox).toBeChecked();
        console.log('✅ First suggestion selected');
      } else {
        console.log('ℹ️ No suggestions available to select');
      }
    });

    // Step 7: Submit the form
    await test.step('Submit the event creation form', async () => {
      // Find and click the "Create Event" button
      const submitButton = page.locator('button[type="submit"]:has-text("Create Event")');
      await submitButton.click();

      // Wait for the button to show loading state
      await expect(submitButton).toHaveText(/Creating.../i, { timeout: 1000 }).catch(() => {
        // If loading state doesn't appear, that's OK - submission might be fast
      });
    });

    // Step 8: Verify success
    await test.step('Verify event creation success', async () => {
      // Wait for success message
      const successMessage = page.locator('text=Event created successfully');
      await expect(successMessage).toBeVisible({ timeout: 5000 });

      // Verify the dialog is closed or shows confirmation
      // The dialog should either close (not visible) or show the success state
      await page.waitForTimeout(1000); // Give time for success message to be visible

      // Check if dialog closed (Create Event title not visible) or showing success
      const dialogClosed = await page.locator('h2:has-text("Create New Event")').isHidden().catch(() => false);
      const successVisible = await successMessage.isVisible().catch(() => false);
      
      expect(dialogClosed || successVisible).toBeTruthy();
      console.log('✅ Event created successfully!');
    });

    // Optional: Verify event appears in calendar
    await test.step('Verify event appears in dashboard', async () => {
      // Wait a bit for the dialog to close and calendar to refresh
      await page.waitForTimeout(1000);

      // Look for the event title in the calendar view
      // Note: This is optional as the event might be on a different date view
      const eventInCalendar = page.locator('text=Doctor appointment').first();
      const eventVisible = await eventInCalendar.isVisible().catch(() => false);
      
      if (eventVisible) {
        console.log('✅ Event visible in calendar');
      } else {
        console.log('ℹ️ Event might be on a different calendar view');
      }
    });
  });

  test('should handle form validation errors', async ({ page }) => {
    // Login first
    await test.step('Login', async () => {
      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.locator('button:has-text("Zaloguj się")').click();
      await expect(page.locator('h1:has-text("HomeHQ")')).toBeVisible({ timeout: 10000 });
    });

    // Open dialog
    await test.step('Open create event dialog', async () => {
      const addEventButton = page.locator('button:has-text("Add Event")');
      await expect(addEventButton).toBeVisible({ timeout: 5000 });
      await addEventButton.click();
      await expect(page.locator('h2:has-text("Create New Event")')).toBeVisible();
    });

    // Try to submit without filling required fields
    await test.step('Submit empty form', async () => {
      const submitButton = page.locator('button[type="submit"]:has-text("Create Event")');
      await submitButton.click();

      // HTML5 validation should prevent submission
      // Check if form is still open (title field should show validation)
      const titleInput = page.locator('input#title');
      const isInvalid = await titleInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBeTruthy();
    });
  });

  test('should allow canceling event creation', async ({ page }) => {
    // Login
    await test.step('Login', async () => {
      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.locator('button:has-text("Zaloguj się")').click();
      await expect(page.locator('h1:has-text("HomeHQ")')).toBeVisible({ timeout: 10000 });
    });

    // Open dialog
    await test.step('Open and cancel', async () => {
      const addEventButton = page.locator('button:has-text("Add Event")');
      await expect(addEventButton).toBeVisible({ timeout: 5000 });
      await addEventButton.click();
      await expect(page.locator('h2:has-text("Create New Event")')).toBeVisible();

      // Click cancel button
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Dialog should close
      await expect(page.locator('h2:has-text("Create New Event")')).toBeHidden({ timeout: 2000 });
    });
  });
});
