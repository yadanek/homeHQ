/**
 * Task Due Date Picker Component
 * 
 * Date picker with automatic ISO 8601 ↔ date conversion.
 * Handles optional dates (null values) gracefully.
 * 
 * @component
 * @example
 * ```tsx
 * <TaskDueDatePicker
 *   value={dueDate}
 *   onChange={(iso) => setDueDate(iso)}
 *   disabled={isLoading}
 * />
 * ```
 */

import { useCallback, useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logError } from '@/utils/response.utils';

/**
 * Props for TaskDueDatePicker component
 */
interface TaskDueDatePickerProps {
  /** Current value in ISO 8601 format or null */
  value: string | null;
  /** Callback fired when date changes, receives ISO 8601 or null */
  onChange: (value: string | null) => void;
  /** Validation error message to display */
  error?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Task Due Date Picker Component
 * 
 * Features:
 * - Converts between ISO 8601 (API) and date (HTML5)
 * - Optional field (null support)
 * - Native browser date picker
 * - Error state with accessible error messages
 * - Helper text explaining optional nature
 */
export function TaskDueDatePicker({ value, onChange, error, disabled = false }: TaskDueDatePickerProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  // Convert ISO 8601 to date format (YYYY-MM-DD)
  const localValue = value ? value.slice(0, 10) : '';

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextLocalValue = event.target.value;

      if (!nextLocalValue) {
        onChange(null);
        return;
      }

      try {
        // Convert date (YYYY-MM-DD) to ISO 8601 at midnight UTC
        const date = new Date(nextLocalValue);
        const isoValue = date.toISOString();
        onChange(isoValue);
      } catch (err) {
        logError(err, { scope: 'TaskDueDatePicker', value: nextLocalValue });
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Due Date</Label>
      <Input
        id={inputId}
        type="date"
        value={localValue}
        onChange={handleChange}
        disabled={disabled}
        aria-describedby={error ? errorId : hintId}
        aria-invalid={error ? 'true' : 'false'}
        className={error ? 'border-destructive' : ''}
      />
      {!error && (
        <p id={hintId} className="text-sm text-muted-foreground">
          Optional. Tasks without dates go to &quot;No Due Date&quot; section.
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
