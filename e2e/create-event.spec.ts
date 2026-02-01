import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { deleteEventByTitle } from './utils/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

const TEST_EMAIL = process.env.E2E_USERNAME || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'Test123456!';

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
    // Skip this test in CI for now - it requires real Supabase connection
    // and may be flaky due to network conditions
    test.skip(!!process.env.CI, 'Skipping integration test in CI - use unit tests instead');
    
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
    });

    // Step 6: Select first suggestion if available
    await test.step('Select first AI suggestion if available', async () => {
      // Look for checkboxes in suggestions
      const firstSuggestionCheckbox = page.locator('input[type="checkbox"][id^="suggestion-"]').first();
      const checkboxExists = await firstSuggestionCheckbox.isVisible().catch(() => false);
      
      if (checkboxExists) {
        await firstSuggestionCheckbox.check();
        await expect(firstSuggestionCheckbox).toBeChecked();
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
      const dialogTitle = page.locator('h2:has-text("Create New Event")');
      
      // Wait a bit for submission to process
      await page.waitForTimeout(2000);
      
      // Check for any error messages first
      const errorSelectors = [
        '[role="alert"]',
        '[class*="error"]',
        '[class*="text-red"]',
        'text=/error|failed|invalid/i'
      ];
      
      for (const selector of errorSelectors) {
        const errorElement = page.locator(selector).first();
        const hasError = await errorElement.isVisible().catch(() => false);
        if (hasError) {
          const errorText = await errorElement.textContent().catch(() => '');
          console.error('Error found:', errorText);
          // Take a screenshot for debugging
          await page.screenshot({ path: 'test-results/error-screenshot.png', fullPage: true });
        }
      }
      
      // Check if submit button is still in loading state
      const submitButton = page.locator('button[type="submit"]:has-text("Create Event"), button:has-text("Creating")');
      const isLoading = await submitButton.isVisible().catch(() => false);
      if (isLoading) {
        console.log('Submit button still visible/loading');
      }
      
      // Wait for dialog to close (this is the success indicator)
      // The dialog closes automatically after successful creation
      await expect(dialogTitle).toBeHidden({ timeout: 15000 });
      
      // Verify we're back on the dashboard
      await expect(page.locator('h1:has-text("HomeHQ")')).toBeVisible();
    });

    // Cleanup: Delete the created event
    await test.step('Cleanup: Delete created event', async () => {
      // Wait for dialog to fully close
      await page.waitForTimeout(1500);

      // Find and click on the created event
      const eventInCalendar = page.locator('text=Doctor appointment').first();
      const eventVisible = await eventInCalendar.isVisible().catch(() => false);
      
      if (eventVisible) {
        await eventInCalendar.click();
        
        // Wait for event details dialog to open
        await page.waitForTimeout(500);
        
        // Click delete button (trash icon or Delete button)
        const deleteButton = page.locator('button[aria-label="Delete event"]').or(
          page.locator('button:has-text("Delete")')
        );
        
        const deleteVisible = await deleteButton.first().isVisible().catch(() => false);
        if (deleteVisible) {
          await deleteButton.first().click();
          
          // Confirm deletion if there's a confirmation dialog
          const confirmButton = page.locator('button:has-text("Confirm")').or(
            page.locator('button:has-text("Delete")')
          );
          await confirmButton.first().click().catch(() => {});
          
          // Wait for deletion to complete
          await page.waitForTimeout(500);
        }
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
      // The dialog should still be open
      const dialogTitle = page.locator('h2:has-text("Create New Event")');
      await expect(dialogTitle).toBeVisible();
      
      // No success message should appear
      const successMessage = page.locator('text=Event created successfully');
      await expect(successMessage).not.toBeVisible();
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
