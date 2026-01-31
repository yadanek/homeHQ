/**
 * Type definitions for onboarding views
 * 
 * Contains types specific to the onboarding process including
 * family creation, joining families, and setup flows.
 */

/**
 * Form data for family creation
 * Used locally in the CreateFamilyForm component
 */
export interface CreateFamilyFormData {
  name: string; // Family name entered by user
}

/**
 * View state for CreateFamilyPage
 * Manages the overall state of the family creation view
 */
export interface CreateFamilyViewState {
  formData: CreateFamilyFormData;
  isSubmitting: boolean;
  validationError: string | null;
  apiError: ApiError | null;
  showSuccess: boolean;
}

/**
 * Validation error for form fields
 * Provides field-specific error information
 */
export interface ValidationError {
  field: keyof CreateFamilyFormData;
  message: string;
}

/**
 * Props for CreateFamilyForm component
 */
export interface CreateFamilyFormProps {
  onSubmit: (data: CreateFamilyFormData) => Promise<void>;
  isSubmitting: boolean;
  error: ApiError | null;
  defaultName?: string; // Pre-fill with "[Display Name]'s Family"
}

/**
 * Props for ExplanationCard component
 */
export interface ExplanationCardProps {
  // No props needed - static content
}

/**
 * Props for SuccessAnimation component
 */
export interface SuccessAnimationProps {
  onComplete: () => void; // Callback after animation completes
}

// Re-export ApiError from main types
import type { ApiError } from '@/types';
export type { ApiError };
