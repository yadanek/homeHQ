/**
 * RegisterForm - Form component for user registration
 * 
 * Handles email, password, and password confirmation input, validation, and submission.
 * Displays validation errors and authentication errors.
 * Uses useAuth hook directly for authentication.
 */

import { useState, useCallback, useId } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorDisplay } from '@/components/tasks/ErrorDisplay';

interface RegisterFormProps {
  /** Optional callback when registration is successful (for navigation handling) */
  onSuccess?: () => void;
}

/**
 * RegisterForm Component
 * 
 * Features:
 * - Email, password, and password confirmation validation
 * - Client-side validation feedback
 * - Password strength requirements (min 6 characters)
 * - Password match validation
 * - Loading state during submission
 * - Error display for validation and auth errors
 * - Accessible form fields
 * - Direct integration with useAuth hook
 */
export function RegisterForm({ 
  onSuccess 
}: RegisterFormProps) {
  const { signUp, isLoading, error: authError } = useAuth();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateName = useCallback((value: string): string | undefined => {
    if (!value.trim()) {
      return 'Imię jest wymagane';
    }
    if (value.trim().length < 2) {
      return 'Imię musi mieć minimum 2 znaki';
    }
    return undefined;
  }, []);

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

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (validationErrors.name) {
      setValidationErrors(prev => ({ ...prev, name: undefined }));
    }
  }, [validationErrors.name]);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: undefined }));
    }
  }, [validationErrors.email]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
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

  const handleNameBlur = useCallback(() => {
    const error = validateName(name);
    setValidationErrors(prev => ({ ...prev, name: error }));
  }, [name, validateName]);

  const handleEmailBlur = useCallback(() => {
    const error = validateEmail(email);
    setValidationErrors(prev => ({ ...prev, email: error }));
  }, [email, validateEmail]);

  const handlePasswordBlur = useCallback(() => {
    const error = validatePassword(password);
    setValidationErrors(prev => ({ ...prev, password: error }));
    // Re-validate confirm password if it has a value
    if (confirmPassword) {
      const confirmError = validateConfirmPassword(confirmPassword, password);
      setValidationErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
  }, [password, confirmPassword, validatePassword, validateConfirmPassword]);

  const handleConfirmPasswordBlur = useCallback(() => {
    const error = validateConfirmPassword(confirmPassword, password);
    setValidationErrors(prev => ({ ...prev, confirmPassword: error }));
  }, [confirmPassword, password, validateConfirmPassword]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 [RegisterForm.handleSubmit] Form submitted');
    
    // Prevent double submission
    if (isLoading) {
      console.log('📝 [RegisterForm.handleSubmit] Already submitting, ignoring...');
      return;
    }
    
    // Validate all fields
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password);
    
    if (nameError || emailError || passwordError || confirmPasswordError) {
      setValidationErrors({
        name: nameError,
        email: emailError,
        password: passwordError,
        confirmPassword: confirmPasswordError,
      });
      return;
    }

    // Clear validation errors
    setValidationErrors({});
    
    // Submit form using useAuth
    console.log('📝 [RegisterForm.handleSubmit] Calling signUp with email:', email.trim(), 'and name:', name.trim());
    const result = await signUp(email.trim(), password, name.trim());
    
    if (result.success && onSuccess) {
      onSuccess();
    }
  }, [name, email, password, confirmPassword, validateName, validateEmail, validatePassword, validateConfirmPassword, signUp, onSuccess, isLoading]);

  const nameError = validationErrors.name;
  const emailError = validationErrors.email;
  const passwordError = validationErrors.password;
  const confirmPasswordError = validationErrors.confirmPassword;
  const nameErrorId = `${nameId}-error`;
  const nameHintId = `${nameId}-hint`;
  const emailErrorId = `${emailId}-error`;
  const emailHintId = `${emailId}-hint`;
  const passwordErrorId = `${passwordId}-error`;
  const passwordHintId = `${passwordId}-hint`;
  const confirmPasswordErrorId = `${confirmPasswordId}-error`;
  const confirmPasswordHintId = `${confirmPasswordId}-hint`;
  
  // Get auth error message from useAuth hook
  const authErrorMessage = authError?.message || null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Registration form">
      {/* Auth Error Display */}
      {authErrorMessage && (
        <ErrorDisplay error={authErrorMessage} />
      )}

      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor={nameId}>
          Imię <span className="text-destructive ml-1" aria-hidden="true">*</span>
        </Label>
        <Input
          id={nameId}
          type="text"
          value={name}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          placeholder="Twoje imię"
          required
          disabled={isLoading}
          aria-describedby={nameError ? nameErrorId : nameHintId}
          aria-invalid={nameError ? 'true' : 'false'}
          className={nameError ? 'border-destructive' : ''}
          autoComplete="name"
        />
        {!nameError && (
          <p id={nameHintId} className="text-sm text-muted-foreground">
            Wprowadź swoje imię
          </p>
        )}
        {nameError && (
          <p id={nameErrorId} className="text-sm text-destructive" role="alert">
            {nameError}
          </p>
        )}
      </div>

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
            Wprowadź ponownie hasło
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
        {isLoading ? 'Tworzenie konta...' : 'Utwórz konto'}
      </Button>
    </form>
  );
}
