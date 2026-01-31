/**
 * Unit Tests for TaskDueDatePicker Component
 * 
 * Tests date picker with ISO 8601 conversion and validation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDueDatePicker } from '@/components/tasks/TaskDueDatePicker';

describe('TaskDueDatePicker', () => {
  describe('Rendering', () => {
    it('should render date input field', () => {
      render(<TaskDueDatePicker value={null} onChange={vi.fn()} />);
      expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    });

    it('should show helper text', () => {
      render(<TaskDueDatePicker value={null} onChange={vi.fn()} />);
      expect(screen.getByText(/optional.*no due date/i)).toBeInTheDocument();
    });

    it('should convert ISO 8601 to datetime-local format', () => {
      const isoDate = '2026-01-05T18:00:00Z';
      render(<TaskDueDatePicker value={isoDate} onChange={vi.fn()} />);
      
      const input = screen.getByLabelText(/due date/i) as HTMLInputElement;
      expect(input.value).toBe('2026-01-05T18:00');
    });

    it('should show empty input when value is null', () => {
      render(<TaskDueDatePicker value={null} onChange={vi.fn()} />);
      
      const input = screen.getByLabelText(/due date/i) as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange with ISO 8601 when date is selected', () => {
      const onChange = vi.fn();
      render(<TaskDueDatePicker value={null} onChange={onChange} />);
      
      const input = screen.getByLabelText(/due date/i);
      fireEvent.change(input, { target: { value: '2026-01-05T18:00' } });
      
      expect(onChange).toHaveBeenCalled();
      const callArg = onChange.mock.calls[0][0];
      // Should convert to ISO 8601
      expect(callArg).toMatch(/2026-01-05T\d{2}:00:00/);
    });

    it('should call onChange with null when date is cleared', () => {
      const onChange = vi.fn();
      render(<TaskDueDatePicker value="2026-01-05T18:00:00Z" onChange={onChange} />);
      
      const input = screen.getByLabelText(/due date/i);
      fireEvent.change(input, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('should update display value when value prop changes', () => {
      const { rerender } = render(
        <TaskDueDatePicker value={null} onChange={vi.fn()} />
      );
      
      let input = screen.getByLabelText(/due date/i) as HTMLInputElement;
      expect(input.value).toBe('');
      
      rerender(<TaskDueDatePicker value="2026-12-31T23:59:00Z" onChange={vi.fn()} />);
      
      input = screen.getByLabelText(/due date/i) as HTMLInputElement;
      expect(input.value).toBe('2026-12-31T23:59');
    });
  });

  describe('Validation', () => {
    it('should show error when provided', () => {
      render(
        <TaskDueDatePicker 
          value={null} 
          onChange={vi.fn()} 
          error="Invalid date format" 
        />
      );
      
      expect(screen.getByText('Invalid date format')).toBeInTheDocument();
    });

    it('should hide helper text when error is shown', () => {
      render(
        <TaskDueDatePicker 
          value={null} 
          onChange={vi.fn()} 
          error="Invalid date" 
        />
      );
      
      expect(screen.queryByText(/optional.*no due date/i)).not.toBeInTheDocument();
    });

    it('should mark input as invalid when error is present', () => {
      render(
        <TaskDueDatePicker 
          value={null} 
          onChange={vi.fn()} 
          error="Invalid date" 
        />
      );
      
      const input = screen.getByLabelText(/due date/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper label association', () => {
      render(<TaskDueDatePicker value={null} onChange={vi.fn()} />);
      const input = screen.getByLabelText(/due date/i);
      expect(input).toHaveAttribute('id');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<TaskDueDatePicker value={null} onChange={vi.fn()} disabled />);
      const input = screen.getByLabelText(/due date/i);
      expect(input).toBeDisabled();
    });

    it('should have datetime-local input type', () => {
      render(<TaskDueDatePicker value={null} onChange={vi.fn()} />);
      const input = screen.getByLabelText(/due date/i);
      expect(input).toHaveAttribute('type', 'datetime-local');
    });
  });

  describe('Date Conversion', () => {
    it('should handle ISO 8601 with milliseconds', () => {
      const isoDate = '2026-01-05T18:00:00.123Z';
      render(<TaskDueDatePicker value={isoDate} onChange={vi.fn()} />);
      
      const input = screen.getByLabelText(/due date/i) as HTMLInputElement;
      expect(input.value).toBe('2026-01-05T18:00');
    });

    it('should handle ISO 8601 without Z suffix (assuming UTC)', () => {
      const isoDate = '2026-01-05T18:00:00';
      const onChange = vi.fn();
      render(<TaskDueDatePicker value={null} onChange={onChange} />);
      
      const input = screen.getByLabelText(/due date/i);
      fireEvent.change(input, { target: { value: '2026-01-05T18:00' } });
      
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid ISO 8601 gracefully', () => {
      // Should not crash with invalid date
      render(<TaskDueDatePicker value="invalid-date" onChange={vi.fn()} />);
      const input = screen.getByLabelText(/due date/i) as HTMLInputElement;
      // Should show empty or handle gracefully
      expect(input).toBeInTheDocument();
    });

    it('should handle far future dates', () => {
      const isoDate = '2099-12-31T23:59:00Z';
      render(<TaskDueDatePicker value={isoDate} onChange={vi.fn()} />);
      
      const input = screen.getByLabelText(/due date/i) as HTMLInputElement;
      expect(input.value).toBe('2099-12-31T23:59');
    });

    it('should handle dates with timezone offsets', () => {
      const onChange = vi.fn();
      render(<TaskDueDatePicker value={null} onChange={onChange} />);
      
      const input = screen.getByLabelText(/due date/i);
      fireEvent.change(input, { target: { value: '2026-01-05T18:00' } });
      
      // Should convert to proper ISO 8601
      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0];
      expect(result).toContain('2026-01-05');
    });
  });
});
