/**
 * LoginForm - Form component for user login
 * 
 * Handles email and password input, validation, and submission.
 * Displays validation errors and authentication errors.
 * Uses useAuth hook directly for authentication.
 */

import { useState, useCallback, useId } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorDisplay } from '@/components/tasks/ErrorDisplay';

interface LoginFormProps {
  /** Optional callback when login is successful (for navigation handling) */
  onSuccess?: () => void;
}

/**
 * LoginForm Component
 * 
 * Features:
 * - Email and password validation
 * - Client-side validation feedback
 * - Loading state during submission
 * - Error display for validation and auth errors
 * - Accessible form fields
 * - Direct integration with useAuth hook
 */
export function LoginForm({ 
  onSuccess 
}: LoginFormProps) {
  const { signIn, isLoading, error: authError } = useAuth();
  const emailId = useId();
  const passwordId = useId();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

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

  const validatePassword = useCallback((value: string): string | undefined => {
    if (!value) {
      return 'Hasło jest wymagane';
    }
    return undefined;
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    // Clear validation error when user starts typing
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: undefined }));
    }
  }, [validationErrors.email]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    // Clear validation error when user starts typing
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: undefined }));
    }
  }, [validationErrors.password]);

  const handleEmailBlur = useCallback(() => {
    const error = validateEmail(email);
    setValidationErrors(prev => ({ ...prev, email: error }));
  }, [email, validateEmail]);

  const handlePasswordBlur = useCallback(() => {
    const error = validatePassword(password);
    setValidationErrors(prev => ({ ...prev, password: error }));
  }, [password, validatePassword]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    if (emailError || passwordError) {
      setValidationErrors({
        email: emailError,
        password: passwordError,
      });
      return;
    }

    // Clear validation errors
    setValidationErrors({});
    
    // Submit form using useAuth
    const result = await signIn(email.trim(), password);
    
    if (result.success && onSuccess) {
      onSuccess();
    }
  }, [email, password, validateEmail, validatePassword, signIn, onSuccess]);

  const emailError = validationErrors.email;
  const passwordError = validationErrors.password;
  const emailErrorId = `${emailId}-error`;
  const emailHintId = `${emailId}-hint`;
  const passwordErrorId = `${passwordId}-error`;
  const passwordHintId = `${passwordId}-hint`;
  
  // Get auth error message from useAuth hook
  const authErrorMessage = authError?.message || null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
      {/* Auth Error Display */}
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
            Wprowadź swój adres email
          </p>
        )}
        {emailError && (
          <p id={emailErrorId} className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor={passwordId}>
          Hasło <span className="text-destructive ml-1" aria-hidden="true">*</span>
        </Label>
        <Input
          id={passwordId}
          type="password"
          value={password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          placeholder="••••••••"
          required
          disabled={isLoading}
          aria-describedby={passwordError ? passwordErrorId : passwordHintId}
          aria-invalid={passwordError ? 'true' : 'false'}
          className={passwordError ? 'border-destructive' : ''}
          autoComplete="current-password"
        />
        {!passwordError && (
          <p id={passwordHintId} className="text-sm text-muted-foreground">
            Wprowadź swoje hasło
          </p>
        )}
        {passwordError && (
          <p id={passwordErrorId} className="text-sm text-destructive" role="alert">
            {passwordError}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Logowanie...' : 'Zaloguj się'}
      </Button>
    </form>
  );
}
