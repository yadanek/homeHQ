import { test, expect } from './fixtures';
import { getDaysFromNow } from './utils/helpers';

/**
 * Example E2E Test using Custom Fixtures
 * 
 * Demonstrates how to use custom fixtures for cleaner, more maintainable tests.
 * The authenticatedPage fixture automatically handles login.
 */
test.describe('Create Event with Fixtures', () => {
  test('should create event using fixtures', async ({ 
    authenticatedPage, 
    dashboardPage, 
    createEventDialog 
  }) => {
    // Page is already authenticated and on dashboard
    
    const eventDate = getDaysFromNow(3);

    await test.step('Open create event dialog', async () => {
      await dashboardPage.openCreateEventDialog();
      await createEventDialog.waitForOpen();
    });

    await test.step('Create event', async () => {
      await createEventDialog.createEvent({
        title: 'Dentist Appointment',
        description: 'Regular checkup',
        startDate: eventDate,
        startHours: 9,
        startMinutes: 0,
        endDate: eventDate,
        endHours: 10,
        endMinutes: 0,
        waitForSuggestions: true,
        selectFirstSuggestion: true,
      });
    });

    await test.step('Verify success', async () => {
      await createEventDialog.waitForSuccess();
    });
  });

  test('should open and cancel dialog using fixtures', async ({ 
    authenticatedPage, 
    dashboardPage, 
    createEventDialog 
  }) => {
    await dashboardPage.openCreateEventDialog();
    await createEventDialog.waitForOpen();
    
    await createEventDialog.fillTitle('Temporary Event');
    await createEventDialog.cancel();
    
    await createEventDialog.waitForClose();
  });
});
