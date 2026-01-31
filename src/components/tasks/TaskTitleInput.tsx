/**
 * Task Title Input Component
 * 
 * Controlled input field for task title with validation, error display,
 * and accessibility features.
 * 
 * @component
 * @example
 * ```tsx
 * <TaskTitleInput
 *   value={title}
 *   onChange={setTitle}
 *   error={validationError}
 *   autoFocus
 * />
 * ```
 */

import { useCallback, useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Props for TaskTitleInput component
 */
interface TaskTitleInputProps {
  /** Current value of the input */
  value: string;
  /** Callback fired when input value changes */
  onChange: (value: string) => void;
  /** Validation error message to display */
  error?: string;
  /** Whether to autofocus the input on mount */
  autoFocus?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Task Title Input Component
 * 
 * Features:
 * - Required field with visual indicator
 * - Error state with accessible error messages
 * - Helper text when no error
 * - Proper ARIA attributes for screen readers
 * - Unique IDs for accessibility
 */
export function TaskTitleInput({
  value,
  onChange,
  error,
  autoFocus = false,
  disabled = false,
}: TaskTitleInputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        Task Title <span className="text-destructive ml-1" aria-hidden="true">*</span>
      </Label>
      <Input
        id={inputId}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="e.g., Buy groceries"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        disabled={disabled}
        required
        aria-describedby={error ? errorId : hintId}
        aria-invalid={error ? 'true' : 'false'}
        className={error ? 'border-destructive' : ''}
      />
      {!error && (
        <p id={hintId} className="text-sm text-muted-foreground">
          Required. Keep it short and actionable.
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
