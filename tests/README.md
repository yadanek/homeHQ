# Testing Guide

## Overview

This directory contains all test files for the HomeHQ project, including unit tests, integration tests, and test plans for Edge Functions.

## Test Framework

We use **Vitest** as our test framework, which is:
- Fast and lightweight
- Compatible with Vite
- Has Jest-compatible API
- Built-in TypeScript support

## Installation

### Install Test Dependencies

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Update package.json

Add test scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Tests with UI

```bash
npm run test:ui
```

Opens interactive UI at `http://localhost:51204/__vitest__/`

### Run Specific Test File

```bash
npm test -- tests/services/events.service.test.ts
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory.

## Test Structure

```
tests/
├── README.md                           # This file
├── setup.ts                            # Global test setup
├── services/                           # Service layer tests
│   └── events.service.test.ts
├── validations/                        # Zod schema tests
│   └── events.schema.test.ts
├── actions/                            # React action tests
│   └── createEvent.test.ts
├── hooks/                              # React hook tests
│   └── useEvents.test.tsx
├── components/                         # Component tests
│   └── events/
│       └── CreateEventForm.test.tsx
└── edge-functions/                     # Edge Function test plans
    └── analyze-event-for-suggestions.test.md
```

## Test Categories

### 1. Unit Tests

Test individual functions and methods in isolation.

**Location**: `tests/services/`, `tests/validations/`

**Example**:
```typescript
describe('EventsService', () => {
  it('should create event without suggestions', async () => {
    // Arrange
    const mockData = {...};
    
    // Act
    const result = await service.createEvent(mockData);
    
    // Assert
    expect(result.event.id).toBeDefined();
  });
});
```

### 2. Integration Tests

Test multiple components working together.

**Location**: `tests/actions/`, `tests/hooks/`

**Example**:
```typescript
describe('createEvent action', () => {
  it('should create event and return success', async () => {
    const result = await createEvent(validRequest);
    expect(result.success).toBe(true);
  });
});
```

### 3. Component Tests

Test React components with user interactions.

**Location**: `tests/components/`

**Example**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';

describe('CreateEventForm', () => {
  it('should submit form with valid data', async () => {
    render(<CreateEventForm />);
    
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Test Event' }
    });
    
    fireEvent.click(screen.getByText('Create Event'));
    
    await waitFor(() => {
      expect(screen.getByText('Event created')).toBeInTheDocument();
    });
  });
});
```

### 4. Edge Function Tests

Manual test plans for Supabase Edge Functions.

**Location**: `tests/edge-functions/`

**Run**:
```bash
# Deploy locally
supabase functions deploy analyze-event-for-suggestions --no-verify-jwt

# Test with curl
curl -X POST http://localhost:54321/functions/v1/analyze-event-for-suggestions \
  -H "Content-Type: application/json" \
  -d '{"title":"Doctor appointment","start_time":"2026-02-01T10:00:00Z"}'
```

## Writing Tests

### Best Practices

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **One Assertion Per Test**: Keep tests focused
3. **Use Descriptive Names**: Test name should describe what it tests
4. **Mock External Dependencies**: Don't call real APIs
5. **Test Edge Cases**: Not just happy path

### Example Test

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventsService } from '@/services/events.service';

describe('EventsService.createEventWithSuggestions', () => {
  let service: EventsService;
  let mockSupabase: any;

  beforeEach(() => {
    // Arrange: Set up mocks
    mockSupabase = {
      from: vi.fn(),
      functions: { invoke: vi.fn() }
    };
    service = new EventsService(mockSupabase);
  });

  it('should create event and generate suggestions', async () => {
    // Arrange: Mock data
    const request = {
      title: 'Doctor appointment',
      start_time: '2026-02-01T10:00:00Z',
      end_time: '2026-02-01T11:00:00Z',
      is_private: false
    };

    // Mock AI engine response
    vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
      data: {
        suggestions: [{
          suggestion_id: 'health',
          title: 'Prepare medical documents',
          due_date: '2026-01-31T10:00:00Z'
        }]
      }
    });

    // Act: Call the method
    const result = await service.createEventWithSuggestions(
      request, 'user-id', 'family-id', 'admin'
    );

    // Assert: Verify results
    expect(result.event).toBeDefined();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].suggestion_id).toBe('health');
  });
});
```

## Mocking

### Mock Supabase Client

```typescript
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockData, error: null })
  })),
  auth: {
    getUser: vi.fn().mockResolvedValue({ 
      data: { user: mockUser }, 
      error: null 
    })
  },
  functions: {
    invoke: vi.fn().mockResolvedValue({ 
      data: mockSuggestions, 
      error: null 
    })
  }
};
```

### Mock React Router

```typescript
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'test-id' }),
}));
```

## Test Coverage

### Target Coverage

| Category | Target | Current |
|----------|--------|---------|
| Statements | 80% | TBD |
| Branches | 75% | TBD |
| Functions | 80% | TBD |
| Lines | 80% | TBD |

### View Coverage Report

```bash
npm run test:coverage
open coverage/index.html
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:run
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Troubleshooting

### Issue: "Cannot find module '@/...'"

**Solution**: Ensure path alias is configured in `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Issue: "ReferenceError: expect is not defined"

**Solution**: Add `globals: true` to `vitest.config.ts`:
```typescript
test: {
  globals: true,
}
```

### Issue: Mock not working

**Solution**: Use `vi.mocked()` helper:
```typescript
import { vi } from 'vitest';
vi.mocked(mockFunction).mockReturnValue('test');
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)

## Contributing

When adding new features:
1. Write tests first (TDD approach recommended)
2. Ensure all tests pass before committing
3. Add tests for edge cases
4. Update this README if adding new test patterns

---

**Last Updated**: 2026-01-26  
**Test Framework**: Vitest 1.x  
**Coverage Target**: 80%


