/**
 * Unit Tests for ErrorDisplay Component
 * 
 * Tests rendering of error messages with proper styling and accessibility
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorDisplay } from '@/components/tasks/ErrorDisplay';

describe('ErrorDisplay', () => {
  describe('Rendering', () => {
    it('should render nothing when error is null', () => {
      const { container } = render(<ErrorDisplay error={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render error message when error is provided', () => {
      render(<ErrorDisplay error="Title is required" />);
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    it('should render long error message', () => {
      const longError = 'Cannot assign task to user outside your family. Please select a member from your family.';
      render(<ErrorDisplay error={longError} />);
      expect(screen.getByText(longError)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert"', () => {
      render(<ErrorDisplay error="Test error" />);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('should be visible to screen readers', () => {
      const { container } = render(<ErrorDisplay error="Important error message" />);
      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Styling', () => {
    it('should apply destructive variant styling', () => {
      const { container } = render(<ErrorDisplay error="Test error" />);
      const alert = container.firstChild;
      expect(alert).toHaveClass('border-destructive');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error string', () => {
      render(<ErrorDisplay error="" />);
      // Empty string is falsy, so should not render
      const { container } = render(<ErrorDisplay error="" />);
      expect(container.firstChild).toBeNull();
    });

    it('should handle error with special characters', () => {
      const error = 'Error: Invalid input "test@example.com" - must be unique!';
      render(<ErrorDisplay error={error} />);
      expect(screen.getByText(error)).toBeInTheDocument();
    });

    it('should handle very long error message', () => {
      const longError = 'A'.repeat(500);
      render(<ErrorDisplay error={longError} />);
      expect(screen.getByText(longError)).toBeInTheDocument();
    });
  });
});
