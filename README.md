# HomeHQ - Family Management Dashboard

Family management web app designed to reduce parental mental load by centralizing calendars, task lists, and private notes in one secure hub.

## Tech Stack

- **Vite 6** - Build tool
- **TypeScript 5** - Type safety
- **React 19** - UI library with React Compiler
- **Tailwind CSS 4** - Styling
- **date-fns** - Date utilities
- **Lucide React** - Icons

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing

### E2E Tests (Playwright)

End-to-end tests for critical user flows:

```bash
# Run tests in headless mode
npm run test:e2e

# Run tests with UI (interactive)
npm run test:e2e:ui

# Run tests with visible browser
npm run test:e2e:headed

# Debug tests step by step
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

**Test Coverage:**
- ✅ Event creation with AI task suggestions
- ✅ Form validation
- ✅ Dialog interactions

For more details, see [e2e/QUICK-START.md](e2e/QUICK-START.md) or [e2e/README.md](e2e/README.md).

## Features Implemented

### Dashboard View ✅

- **Calendar Grid** - Monthly calendar with event and task display
- **Event Color Coding** - Blue for private events, green for family events (US-000)
- **Private Event Lock Icons** - Visual indicator for private events (US-004)
- **Date Selection** - Click dates to filter tasks in sidebar
- **Month Navigation** - Navigate between months with arrow buttons
- **Filter Toggle** - Everything / My / Family event filter
- **Daily Tasks Sidebar** - Shows tasks for selected date
- **Task Completion** - Toggle checkbox with optimistic UI
- **Responsive Design** - Desktop (calendar + sidebar), Tablet/Mobile (calendar only)

### Data & State Management ✅

- **Custom Hook** - `useDashboard()` for centralized state management
- **Mock Data Service** - Sample events and tasks for development
- **Optimistic UI** - Instant feedback for task completion with rollback on error
- **Error Handling** - Toast notifications for errors

### Task Creation Modal ✅

- **Task Creation Dialog** - Modal for creating manual tasks
- **Form Components** - Modular, reusable input components:
  - `TaskTitleInput` - Required field with validation and a11y
  - `TaskDueDatePicker` - Optional datetime picker with ISO 8601 conversion
  - `AssigneePicker` - Reusable family member selector (profiles + members)
  - `ErrorDisplay` - Accessible error message display
- **useCreateTask Hook** - React 19 useTransition + Zod validation
- **Validation** - Client-side Zod schema validation before API call
- **Accessibility** - ARIA labels, keyboard navigation (ESC to close), focus management
- **Responsive** - Mobile-first design with stacked buttons on small screens
- **Animations** - Smooth fade-in/fade-out transitions
- **Unit Tests** - Comprehensive Vitest tests for all components and hooks

## Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components (Button, Card, Badge, etc.)
│   └── dashboard/       # Dashboard-specific components
├── hooks/               # Custom React hooks
├── pages/               # Page components
├── services/            # API services and mock data
├── types/               # TypeScript type definitions
├── utils/               # Helper functions and utilities
└── db/                  # Database types (Supabase)
```

## Development Notes

- Mock data is used for development (see `src/services/mockData.ts`)
- Console logs are intentionally left for debugging modal interactions (placeholders)
- React Compiler is enabled for automatic optimization

## Next Steps

- [ ] Implement Event Creation Modal (US-003)
- [ ] Implement Task Creation Modal
- [ ] Add real-time updates
- [ ] Integrate with Supabase backend
- [ ] Add authentication flow
- [ ] Implement AI task suggestions

## License

Private project
