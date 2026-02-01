import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Create Event Dialog
 * 
 * Encapsulates all event creation dialog interactions and assertions.
 */
export class CreateEventDialog {
  readonly page: Page;
  readonly dialog: Locator;
  readonly dialogTitle: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly startTimeInput: Locator;
  readonly endTimeInput: Locator;
  readonly privateCheckbox: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly aiSuggestionsSection: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('[role="dialog"]');
    this.dialogTitle = page.locator('h2:has-text("Create New Event")');
    this.titleInput = page.locator('input#title');
    this.descriptionInput = page.locator('textarea#description');
    this.startTimeInput = page.locator('input#startTime');
    this.endTimeInput = page.locator('input#endTime');
    this.privateCheckbox = page.locator('input#isPrivate');
    this.submitButton = page.locator('button[type="submit"]:has-text("Create Event")');
    this.cancelButton = page.locator('button:has-text("Cancel")');
    this.successMessage = page.locator('text=Event created successfully');
    this.errorMessage = page.locator('.text-red-800, .text-red-400');
    this.aiSuggestionsSection = page.locator('h3:has-text("AI Task Suggestions")');
    this.loadingIndicator = page.locator('text=Analyzing event...');
  }

  /**
   * Wait for dialog to be visible
   */
  async waitForOpen() {
    await expect(this.dialogTitle).toBeVisible({ timeout: 5000 });
  }

  /**
   * Fill in the event title
   */
  async fillTitle(title: string) {
    await this.titleInput.fill(title);
    await expect(this.titleInput).toHaveValue(title);
  }

  /**
   * Fill in the event description
   */
  async fillDescription(description: string) {
    await this.descriptionInput.fill(description);
  }

  /**
   * Set start time using datetime-local format
   */
  async setStartTime(date: Date, hours: number, minutes: number) {
    const dateTime = this.formatDateTimeLocal(date, hours, minutes);
    await this.startTimeInput.fill(dateTime);
    await expect(this.startTimeInput).toHaveValue(dateTime);
  }

  /**
   * Set end time using datetime-local format
   */
  async setEndTime(date: Date, hours: number, minutes: number) {
    const dateTime = this.formatDateTimeLocal(date, hours, minutes);
    await this.endTimeInput.fill(dateTime);
    await expect(this.endTimeInput).toHaveValue(dateTime);
  }

  /**
   * Helper: Format date for datetime-local input
   */
  private formatDateTimeLocal(date: Date, hours: number, minutes: number): string {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  /**
   * Wait for AI suggestions to load (with timeout)
   */
  async waitForAISuggestions(timeoutMs: number = 2000) {
    // Wait for debounce (500ms in code)
    await this.page.waitForTimeout(600);
    
    // Wait for suggestions or timeout
    await Promise.race([
      this.aiSuggestionsSection.waitFor({ timeout: timeoutMs }).catch(() => null),
      this.page.waitForTimeout(timeoutMs)
    ]);
  }

  /**
   * Check if AI suggestions are visible
   */
  async hasSuggestions(): Promise<boolean> {
    return await this.aiSuggestionsSection.isVisible().catch(() => false);
  }

  /**
   * Get all suggestion checkboxes
   */
  getSuggestionCheckboxes() {
    return this.page.locator('input[type="checkbox"][id^="suggestion-"]');
  }

  /**
   * Select the first AI suggestion
   */
  async selectFirstSuggestion(): Promise<boolean> {
    const firstCheckbox = this.getSuggestionCheckboxes().first();
    const exists = await firstCheckbox.isVisible().catch(() => false);
    
    if (exists) {
      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();
      return true;
    }
    
    return false;
  }

  /**
   * Submit the form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Cancel and close the dialog
   */
  async cancel() {
    await this.cancelButton.click();
  }

  /**
   * Wait for success message
   */
  async waitForSuccess() {
    await expect(this.successMessage).toBeVisible({ timeout: 5000 });
  }

  /**
   * Wait for dialog to close
   */
  async waitForClose() {
    await expect(this.dialogTitle).toBeHidden({ timeout: 2000 });
  }

  /**
   * Complete event creation flow
   */
  async createEvent(data: {
    title: string;
    description?: string;
    startDate: Date;
    startHours: number;
    startMinutes: number;
    endDate: Date;
    endHours: number;
    endMinutes: number;
    waitForSuggestions?: boolean;
    selectFirstSuggestion?: boolean;
    waitForSuccess?: boolean; // Optional - don't wait if dialog closes quickly
  }) {
    await this.fillTitle(data.title);
    
    if (data.description) {
      await this.fillDescription(data.description);
    }
    
    await this.setStartTime(data.startDate, data.startHours, data.startMinutes);
    await this.setEndTime(data.endDate, data.endHours, data.endMinutes);
    
    if (data.waitForSuggestions) {
      await this.waitForAISuggestions();
      
      if (data.selectFirstSuggestion) {
        await this.selectFirstSuggestion();
      }
    }
    
    await this.submit();
    
    // Always wait for request to complete (success or error)
    // Wait for button to be re-enabled or dialog to close or success message
    // Longer timeout for slower browsers like WebKit
    await Promise.race([
      this.successMessage.waitFor({ state: 'visible', timeout: 15000 }),
      this.dialogTitle.waitFor({ state: 'hidden', timeout: 15000 }),
      this.errorMessage.first().waitFor({ state: 'visible', timeout: 15000 })
    ]).catch(() => {
      // If all fail, wait additional time for slower browsers
      return this.page.waitForTimeout(5000);
    });
  }
}
