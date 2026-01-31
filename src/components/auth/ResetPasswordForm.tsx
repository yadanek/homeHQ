/**
 * ResetPasswordForm - Form component for requesting password reset
 * 
 * Handles email input for password reset request.
 * Displays validation errors and success/error messages.
 * Uses useAuth hook directly for authentication.
 */

import { useState, useCallback, useId } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorDisplay } from '@/components/tasks/ErrorDisplay';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2 } from 'lucide-react';

interface ResetPasswordFormProps {
  /** Optional callback when reset email is successfully sent */
  onSuccess?: () => void;
}

/**
 * ResetPasswordForm Component
 * 
 * Features:
 * - Email validation
 * - Client-side validation feedback
 * - Loading state during submission
 * - Success message display
 * - Error display for validation and backend errors
 * - Accessible form fields
 * - Direct integration with useAuth hook
 */
export function ResetPasswordForm({ 
  onSuccess 
}: ResetPasswordFormProps) {
  const { resetPassword, isLoading, error: authError } = useAuth();
  const emailId = useId();
  
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>();
  const [isSuccess, setIsSuccess] = useState(false);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateEmail = useCallback((value: string): string | undefined => {
    if (!value.trim()) {
      return 'Email jest wymagany';
    }
    if (!emailRegex.test(value)) {
      return 'Nieprawidłowy format email';
    }
    return undefined;
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(undefined);
    }
  }, [validationError]);

  const handleEmailBlur = useCallback(() => {
    const error = validateEmail(email);
    setValidationError(error);
  }, [email, validateEmail]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const emailError = validateEmail(email);
    
    if (emailError) {
      setValidationError(emailError);
      return;
    }

    // Clear validation error
    setValidationError(undefined);
    
    // Submit form using useAuth
    const result = await resetPassword(email.trim());
    
    if (result.success) {
      setIsSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [email, validateEmail, resetPassword, onSuccess]);

  const emailError = validationError;
  const emailErrorId = `${emailId}-error`;
  const emailHintId = `${emailId}-hint`;
  
  // Get auth error message from useAuth hook
  const authErrorMessage = authError?.message || null;

  // Show success message
  if (isSuccess) {
    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Sukces</AlertTitle>
          <AlertDescription>
            Sprawdź swoją skrzynkę email. Wysłaliśmy link do resetu hasła.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Reset password form">
      {/* Error Display */}
      {authErrorMessage && (
        <ErrorDisplay error={authErrorMessage} />
      )}

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor={emailId}>
          Email <span className="text-destructive ml-1" aria-hidden="true">*</span>
        </Label>
        <Input
          id={emailId}
          type="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          placeholder="twoj@email.com"
          required
          disabled={isLoading}
          aria-describedby={emailError ? emailErrorId : emailHintId}
          aria-invalid={emailError ? 'true' : 'false'}
          className={emailError ? 'border-destructive' : ''}
          autoComplete="email"
        />
        {!emailError && (
          <p id={emailHintId} className="text-sm text-muted-foreground">
            Wprowadź adres email powiązany z kontem
          </p>
        )}
        {emailError && (
          <p id={emailErrorId} className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
      </Button>
    </form>
  );
}
