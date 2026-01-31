/**
 * Error Display Component
 * 
 * Displays error messages in a styled alert box with icon.
 * Conditionally renders only when error is present.
 * 
 * @component
 * @example
 * ```tsx
 * <ErrorDisplay error="Title is required" />
 * ```
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

/**
 * Props for ErrorDisplay component
 */
interface ErrorDisplayProps {
  /** Error message or null if no error */
  error: string | null;
}

/**
 * Error Display Component
 * 
 * Features:
 * - Conditional rendering (null when no error)
 * - Destructive variant styling (red alert)
 * - Alert icon for visual emphasis
 * - Accessible with role="alert"
 * - Screen reader friendly
 */
export function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
