/**
 * UpdatePasswordForm - Form component for setting new password after reset
 * 
 * Handles new password and confirmation input, validation, and submission.
 * Used after user clicks reset link in email.
 * Uses useAuth hook directly for authentication.
 */

import { useState, useCallback, useId, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorDisplay } from '@/components/tasks/ErrorDisplay';

interface UpdatePasswordFormProps {
  /** Optional callback when password is successfully updated */
  onSuccess?: () => void;
}

/**
 * UpdatePasswordForm Component
 * 
 * Features:
 * - New password and confirmation validation
 * - Client-side validation feedback
 * - Password strength requirements (min 6 characters)
 * - Password match validation
 * - Loading state during submission
 * - Error display for validation and auth errors
 * - Accessible form fields
 * - Direct integration with useAuth hook
 * - Automatic token extraction from URL hash
 */
export function UpdatePasswordForm({ 
  onSuccess 
}: UpdatePasswordFormProps) {
  const { updatePassword, isLoading, error: authError } = useAuth();
  
  // Extract token from URL hash if present
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') && hash.includes('access_token')) {
      // Supabase automatically handles the token from URL hash
      // We just need to ensure the component is ready
      console.log('[UpdatePasswordForm] Recovery token detected in URL');
    }
  }, []);
  const passwordId = useId();
  const confirmPasswordId = useId();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  const validatePassword = useCallback((value: string): string | undefined => {
    if (!value) {
      return 'Hasło jest wymagane';
    }
    if (value.length < 6) {
      return 'Hasło musi mieć minimum 6 znaków';
    }
    return undefined;
  }, []);

  const validateConfirmPassword = useCallback((value: string, passwordValue: string): string | undefined => {
    if (!value) {
      return 'Potwierdzenie hasła jest wymagane';
    }
    if (value !== passwordValue) {
      return 'Hasła nie są identyczne';
    }
    return undefined;
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    if (validationErrors.password) {
      setValidationErrors(prev => ({ ...prev, password: undefined }));
    }
    // Re-validate confirm password if it has a value
    if (confirmPassword && validationErrors.confirmPassword) {
      const confirmError = validateConfirmPassword(confirmPassword, value);
      setValidationErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
  }, [validationErrors.password, confirmPassword, validationErrors.confirmPassword, validateConfirmPassword]);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (validationErrors.confirmPassword) {
      setValidationErrors(prev => ({ ...prev, confirmPassword: undefined }));
    }
  }, [validationErrors.confirmPassword]);

  const handlePasswordBlur = useCallback(() => {
    const error = validatePassword(newPassword);
    setValidationErrors(prev => ({ ...prev, password: error }));
    // Re-validate confirm password if it has a value
    if (confirmPassword) {
      const confirmError = validateConfirmPassword(confirmPassword, newPassword);
      setValidationErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
  }, [newPassword, confirmPassword, validatePassword, validateConfirmPassword]);

  const handleConfirmPasswordBlur = useCallback(() => {
    const error = validateConfirmPassword(confirmPassword, newPassword);
    setValidationErrors(prev => ({ ...prev, confirmPassword: error }));
  }, [confirmPassword, newPassword, validateConfirmPassword]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const passwordError = validatePassword(newPassword);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, newPassword);
    
    if (passwordError || confirmPasswordError) {
      setValidationErrors({
        password: passwordError,
        confirmPassword: confirmPasswordError,
      });
      return;
    }

    // Clear validation errors
    setValidationErrors({});
    
    // Submit form using useAuth
    // Token is automatically extracted from URL hash by Supabase
    const result = await updatePassword(newPassword);
    
    if (result.success && onSuccess) {
      onSuccess();
    }
  }, [newPassword, confirmPassword, validatePassword, validateConfirmPassword, updatePassword, onSuccess]);

  const passwordError = validationErrors.password;
  const confirmPasswordError = validationErrors.confirmPassword;
  const passwordErrorId = `${passwordId}-error`;
  const passwordHintId = `${passwordId}-hint`;
  const confirmPasswordErrorId = `${confirmPasswordId}-error`;
  const confirmPasswordHintId = `${confirmPasswordId}-hint`;
  
  // Get auth error message from useAuth hook
  const authErrorMessage = authError?.message || null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Update password form">
      {/* Auth Error Display */}
      {authErrorMessage && (
        <ErrorDisplay error={authErrorMessage} />
      )}

      {/* New Password Field */}
      <div className="space-y-2">
        <Label htmlFor={passwordId}>
          Nowe hasło <span className="text-destructive ml-1" aria-hidden="true">*</span>
        </Label>
        <Input
          id={passwordId}
          type="password"
          value={newPassword}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          placeholder="••••••••"
          required
          disabled={isLoading}
          aria-describedby={passwordError ? passwordErrorId : passwordHintId}
          aria-invalid={passwordError ? 'true' : 'false'}
          className={passwordError ? 'border-destructive' : ''}
          autoComplete="new-password"
        />
        {!passwordError && (
          <p id={passwordHintId} className="text-sm text-muted-foreground">
            Minimum 6 znaków
          </p>
        )}
        {passwordError && (
          <p id={passwordErrorId} className="text-sm text-destructive" role="alert">
            {passwordError}
          </p>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <Label htmlFor={confirmPasswordId}>
          Potwierdzenie hasła <span className="text-destructive ml-1" aria-hidden="true">*</span>
        </Label>
        <Input
          id={confirmPasswordId}
          type="password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          onBlur={handleConfirmPasswordBlur}
          placeholder="••••••••"
          required
          disabled={isLoading}
          aria-describedby={confirmPasswordError ? confirmPasswordErrorId : confirmPasswordHintId}
          aria-invalid={confirmPasswordError ? 'true' : 'false'}
          className={confirmPasswordError ? 'border-destructive' : ''}
          autoComplete="new-password"
        />
        {!confirmPasswordError && (
          <p id={confirmPasswordHintId} className="text-sm text-muted-foreground">
            Wprowadź ponownie nowe hasło
          </p>
        )}
        {confirmPasswordError && (
          <p id={confirmPasswordErrorId} className="text-sm text-destructive" role="alert">
            {confirmPasswordError}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Zmienianie hasła...' : 'Zmień hasło'}
      </Button>
    </form>
  );
}
