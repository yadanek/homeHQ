/**
 * Unit Tests for TaskTitleInput Component
 * 
 * Tests input field with validation, accessibility, and user interactions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskTitleInput } from '@/components/tasks/TaskTitleInput';

describe('TaskTitleInput', () => {
  describe('Rendering', () => {
    it('should render input field', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} />);
      expect(screen.getByLabelText(/task title/i)).toBeInTheDocument();
    });

    it('should display provided value', () => {
      render(<TaskTitleInput value="Buy groceries" onChange={vi.fn()} />);
      const input = screen.getByLabelText(/task title/i);
      expect(input).toHaveValue('Buy groceries');
    });

    it('should show required indicator', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should show placeholder text', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText(/e\.g\., buy groceries/i);
      expect(input).toBeInTheDocument();
    });

    it('should show helper text when no error', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} />);
      expect(screen.getByText(/what do you need to do?/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when user types', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      
      render(<TaskTitleInput value="" onChange={onChange} />);
      const input = screen.getByLabelText(/task title/i);
      
      await user.type(input, 'New task');
      
      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenLastCalledWith('New task');
    });

    it('should update value on change', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      
      const { rerender } = render(<TaskTitleInput value="" onChange={onChange} />);
      const input = screen.getByLabelText(/task title/i);
      
      await user.type(input, 'T');
      expect(onChange).toHaveBeenCalledWith('T');
      
      // Rerender with updated value
      rerender(<TaskTitleInput value="T" onChange={onChange} />);
      expect(input).toHaveValue('T');
    });

    it('should allow clearing the input', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      
      render(<TaskTitleInput value="Test" onChange={onChange} />);
      const input = screen.getByLabelText(/task title/i);
      
      await user.clear(input);
      
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('Validation', () => {
    it('should show error when provided', () => {
      render(
        <TaskTitleInput 
          value="" 
          onChange={vi.fn()} 
          error="Title is required" 
        />
      );
      
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    it('should hide helper text when error is shown', () => {
      render(
        <TaskTitleInput 
          value="" 
          onChange={vi.fn()} 
          error="Title is required" 
        />
      );
      
      expect(screen.queryByText(/what do you need to do?/i)).not.toBeInTheDocument();
    });

    it('should apply error styling to input', () => {
      render(
        <TaskTitleInput 
          value="" 
          onChange={vi.fn()} 
          error="Title is required" 
        />
      );
      
      const input = screen.getByLabelText(/task title/i);
      expect(input).toHaveClass('border-destructive');
    });

    it('should mark input as invalid when error is present', () => {
      render(
        <TaskTitleInput 
          value="" 
          onChange={vi.fn()} 
          error="Title is required" 
        />
      );
      
      const input = screen.getByLabelText(/task title/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper label association', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} />);
      const input = screen.getByLabelText(/task title/i);
      expect(input).toHaveAttribute('id');
    });

    it('should associate error message with input', () => {
      render(
        <TaskTitleInput 
          value="" 
          onChange={vi.fn()} 
          error="Title is required" 
        />
      );
      
      const input = screen.getByLabelText(/task title/i);
      const errorId = input.getAttribute('aria-describedby');
      
      expect(errorId).toBeTruthy();
      expect(screen.getByText('Title is required')).toHaveAttribute('id', errorId);
    });

    it('should autofocus when autoFocus prop is true', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} autoFocus />);
      const input = screen.getByLabelText(/task title/i);
      expect(input).toHaveFocus();
    });

    it('should not autofocus by default', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} />);
      const input = screen.getByLabelText(/task title/i);
      expect(input).not.toHaveFocus();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<TaskTitleInput value="" onChange={vi.fn()} disabled />);
      const input = screen.getByLabelText(/task title/i);
      expect(input).toBeDisabled();
    });

    it('should prevent onChange when disabled', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      
      render(<TaskTitleInput value="" onChange={onChange} disabled />);
      const input = screen.getByLabelText(/task title/i);
      
      await user.type(input, 'Should not work');
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error string', () => {
      render(
        <TaskTitleInput 
          value="" 
          onChange={vi.fn()} 
          error="" 
        />
      );
      
      // Empty error should not show error UI
      expect(screen.getByText(/what do you need to do?/i)).toBeInTheDocument();
    });

    it('should handle very long value', () => {
      const longValue = 'A'.repeat(1000);
      render(<TaskTitleInput value={longValue} onChange={vi.fn()} />);
      const input = screen.getByLabelText(/task title/i);
      expect(input).toHaveValue(longValue);
    });

    it('should handle special characters', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      
      render(<TaskTitleInput value="" onChange={onChange} />);
      const input = screen.getByLabelText(/task title/i);
      
      await user.type(input, '!@#$%^&*()');
      
      expect(onChange).toHaveBeenCalled();
    });
  });
});
