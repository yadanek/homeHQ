/**
 * Authentication utility functions for API endpoints
 * 
 * Provides reusable functions for extracting and validating user authentication
 * from Supabase sessions and JWT tokens.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthError } from '@supabase/supabase-js';
import type { Database } from '@/db/database.types';

/**
 * Type for authenticated Supabase client
 */
export type AuthenticatedSupabaseClient = SupabaseClient<Database>;

/**
 * Result type for authentication operations
 */
interface AuthResult {
  user?: {
    id: string;
    email?: string;
  };
  familyId?: string;
  error: {
    code: string;
    message: string;
  } | null;
  status: number;
}

/**
 * Extracts and validates the authenticated user from the current Supabase session
 * 
 * This function checks if the user is authenticated and retrieves their family_id
 * from the profiles table. It handles all common authentication error cases.
 * 
 * @param supabase - Supabase client instance
 * @returns Promise resolving to AuthResult with user info or error details
 * 
 * @example
 * ```typescript
 * const authResult = await extractAndValidateUser(supabase);
 * if (authResult.error) {
 *   return { error: authResult.error, status: authResult.status };
 * }
 * const { user, familyId } = authResult;
 * ```
 */
export async function extractAndValidateUser(
  supabase: AuthenticatedSupabaseClient
): Promise<AuthResult> {
  // Get the current authenticated user from Supabase session
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Check if authentication failed or user doesn't exist
  if (authError || !user) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authentication token'
      },
      status: 401
    };
  }

  // Retrieve user's profile to get family_id
  // RLS policies ensure user can only access their own profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  // Check if profile retrieval failed
  if (profileError || !profile) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'User profile not found or user is not associated with a family'
      },
      status: 401
    };
  }

  // Authentication successful - return user info and family_id
  return {
    user: {
      id: user.id,
      email: user.email
    },
    familyId: profile.family_id,
    error: null,
    status: 200
  };
}

/**
 * Checks if the user has admin role in their family
 * 
 * @param supabase - Supabase client instance
 * @param userId - User's UUID
 * @returns Promise resolving to boolean indicating admin status
 */
export async function isUserAdmin(
  supabase: AuthenticatedSupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return profile?.role === 'admin';
}

/**
 * Maps Supabase authentication errors to user-friendly Polish messages
 * 
 * This function translates technical Supabase error messages into
 * readable messages for end users. It handles common authentication
 * error scenarios like invalid credentials, email conflicts, etc.
 * 
 * @param error - Supabase AuthError object
 * @returns User-friendly error message in Polish
 * 
 * @example
 * ```typescript
 * const { error } = await supabase.auth.signInWithPassword({ email, password });
 * if (error) {
 *   const message = mapAuthError(error);
 *   // Display message to user
 * }
 * ```
 */
export function mapAuthError(error: AuthError): string {
  const errorMessage = error.message.toLowerCase();

  // Invalid login credentials
  if (
    errorMessage.includes('invalid login credentials') ||
    errorMessage.includes('invalid credentials') ||
    errorMessage.includes('email or password')
  ) {
    return 'Nieprawidłowy email lub hasło';
  }

  // Email already registered
  if (
    errorMessage.includes('email already registered') ||
    errorMessage.includes('user already registered') ||
    errorMessage.includes('already exists')
  ) {
    return 'Email jest już zarejestrowany';
  }

  // Password requirements
  if (
    errorMessage.includes('password should be at least') ||
    errorMessage.includes('password too short') ||
    errorMessage.includes('password length')
  ) {
    return 'Hasło musi mieć minimum 6 znaków';
  }

  // Token expired or invalid
  if (
    errorMessage.includes('token has expired') ||
    errorMessage.includes('token is invalid') ||
    errorMessage.includes('expired') ||
    errorMessage.includes('invalid token')
  ) {
    return 'Link resetujący wygasł lub jest nieprawidłowy';
  }

  // User not found
  if (
    errorMessage.includes('user not found') ||
    errorMessage.includes('no user found') ||
    errorMessage.includes('user does not exist')
  ) {
    return 'Nie znaleziono konta z tym emailem';
  }

  // Email confirmation required
  if (
    errorMessage.includes('email confirmation') ||
    errorMessage.includes('email not confirmed') ||
    errorMessage.includes('email_not_confirmed') ||
    errorMessage.includes('unconfirmed email')
  ) {
    return 'Konto zostało utworzone. Sprawdź swoją skrzynkę e-mail i potwierdź adres e-mail, aby kontynuować.';
  }

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection')
  ) {
    return 'Wystąpił błąd połączenia. Sprawdź połączenie internetowe.';
  }

  // Rate limiting
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests')
  ) {
    return 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';
  }

  // Default fallback
  return 'Wystąpił błąd podczas operacji. Spróbuj ponownie.';
}
