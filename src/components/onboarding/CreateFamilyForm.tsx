/**
 * CreateFamilyForm Component
 * 
 * Single-field form for creating a new family hub.
 * Only requires family name - display_name is retrieved automatically from auth context.
 * 
 * Features:
 * - Single text input for family name
 * - Client-side validation (Zod schema)
 * - Inline error messages
 * - Loading state during submission
 * - Alternative action: Join existing family
 * - Accessible form controls
 */

import { useState, useId, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createFamilySchema } from '@/validations/families.schema';
import { MOCK_USER } from '@/lib/mockAuth';
import type { CreateFamilyFormProps, CreateFamilyFormData } from '@/types/onboarding';

/**
 * CreateFamilyForm - Form for creating a new family
 * 
 * Displays a single-field form for family name with validation,
 * error handling, and loading states.
 * 
 * @param onSubmit - Callback invoked with form data when submitted
 * @param isSubmitting - Whether the form is currently being submitted
 * @param error - API error to display (if any)
 * @param defaultName - Pre-filled family name (optional)
 * 
 * @example
 * ```tsx
 * <CreateFamilyForm
 *   onSubmit={handleSubmit}
 *   isSubmitting={isCreating}
 *   error={apiError}
 *   defaultName="John's Family"
 * />
 * ```
 */
export function CreateFamilyForm({ 
  onSubmit, 
  isSubmitting, 
  error, 
  defaultName = '' 
}: CreateFamilyFormProps) {
  // Form state
  const [familyName, setFamilyName] = useState(defaultName);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auth hook
  const { signOut } = useAuth();

  // Generate unique ID for accessibility
  const familyNameId = useId();

  /**
   * Validates the family name field
   * Uses Zod schema for validation
   */
  const validateField = useCallback((value: string): string | null => {
    // Get display_name for validation (required by schema)
    const displayName = MOCK_USER.user_metadata.display_name || 'User';
    
    const result = createFamilySchema.safeParse({
      name: value,
      display_name: displayName
    });

    if (!result.success) {
      const nameError = result.error.issues.find(err => err.path[0] === 'name');
      return nameError ? nameError.message : null;
    }

    return null;
  }, []);

  /**
   * Handle input change
   * Clears validation error when user starts typing
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFamilyName(e.target.value);
    // Clear validation error when user modifies input
    if (validationError) {
      setValidationError(null);
    }
  }, [validationError]);

  /**
   * Handle input blur
   * Validates field when user leaves input
   */
  const handleBlur = useCallback(() => {
    const error = validateField(familyName);
    setValidationError(error);
  }, [familyName, validateField]);

  /**
   * Handle form submission
   * Validates before calling onSubmit callback
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Client-side validation
    const error = validateField(familyName);
    if (error) {
      setValidationError(error);
      return;
    }

    // Call parent callback with form data
    const formData: CreateFamilyFormData = {
      name: familyName.trim()
    };

    await onSubmit(formData);
  };

  /**
   * Handle "Join Family" link click
   */
  const handleJoinFamily = () => {
    // TODO: Navigate to join family page when router is configured
    // navigate('/onboarding/join-family');
  };

  /**
   * Handle sign out
   */
  const handleSignOut = async () => {
    try {
      await signOut();
      // Navigation will be handled by App.tsx based on auth state change
    } catch (error) {
      // Error handled by useAuth hook
    }
  };

  // Check if form is valid and ready to submit
  const isFormValid = familyName.trim().length > 0 && !validationError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your Family Hub</CardTitle>
        <CardDescription>
          Choose a name for your family hub. You&apos;ll become the admin.
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit} aria-label="Create family form">
        <CardContent className="space-y-6">
          {/* Family Name Field */}
          <div className="space-y-2">
            <Label htmlFor={familyNameId}>
              Family Name
              <span className="text-destructive ml-1" aria-label="required">*</span>
            </Label>
            <Input
              id={familyNameId}
              type="text"
              value={familyName}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="e.g., Smith Family, The Johnsons"
              required
              maxLength={100}
              disabled={isSubmitting}
              aria-describedby={
                validationError 
                  ? `${familyNameId}-error` 
                  : `${familyNameId}-hint`
              }
              aria-invalid={validationError ? 'true' : 'false'}
              className={validationError ? 'border-destructive' : ''}
            />
            
            {/* Helper text */}
            {!validationError && (
              <p 
                id={`${familyNameId}-hint`}
                className="text-sm text-muted-foreground"
              >
                This will be the name of your family hub
              </p>
            )}

            {/* Validation error */}
            {validationError && (
              <p 
                id={`${familyNameId}-error`}
                className="text-sm text-destructive flex items-center gap-1"
                role="alert"
              >
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {validationError}
              </p>
            )}
          </div>

          {/* API Error Display */}
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error creating family</AlertTitle>
              <AlertDescription>
                {error.error.message}
                {error.error.details && (
                  <div className="mt-2 text-sm">
                    {typeof error.error.details === 'object' && 'reason' in error.error.details && (
                      <p>{String(error.error.details.reason)}</p>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Creating Family...
              </>
            ) : (
              'Create Family'
            )}
          </Button>

          {/* Alternative Action */}
          <div className="text-center text-sm text-muted-foreground">
            Already have an invitation code?{' '}
            <Button
              type="button"
              variant="ghost"
              className="p-0 h-auto font-normal"
              onClick={handleJoinFamily}
              disabled={isSubmitting}
            >
              Join an Existing Family
            </Button>
          </div>

          {/* Sign Out Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOut}
            className="w-full"
            disabled={isSubmitting}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign Out
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
