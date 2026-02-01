/**
 * useAuth Hook - Authentication and Profile State Management
 * 
 * Provides authentication state and user profile information.
 * In DEV mode, automatically signs in as mock user.
 * 
 * Features:
 * - Automatic sign-in in DEV mode
 * - Profile fetching and caching
 * - Loading states
 * - Error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/db/supabase.client';
import { mapAuthError } from '@/utils/auth.utils';
import type { Tables } from '@/db/database.types';
import type { AuthError } from '@supabase/supabase-js';
import { DEV_MODE, MOCK_USER } from '@/lib/mockAuth';

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
}

export type UserProfile = Tables<'profiles'>;

interface UseAuthReturn {
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasFamily: boolean;
  error: Error | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string, token?: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Custom hook for authentication and profile management
 * 
 * Automatically handles:
 * - DEV mode sign-in
 * - Profile fetching
 * - Session management
 * 
 * @returns Authentication state and user profile
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { user, profile, hasFamily, isLoading } = useAuth();
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!hasFamily) return <CreateFamilyPage />;
 *   return <DashboardView />;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userFamily, setUserFamily] = useState<Tables<'families'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);  
  // Use ref to track last fetched user ID to prevent duplicate fetches
  const lastFetchedUserIdRef = useRef<string | null>(null);  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  /**
   * Fetches user profile from database
   * Returns null if profile doesn't exist (expected for new users)
   */
  const fetchProfile = useCallback(async (userId: string) => {
    // Skip if already fetching to prevent duplicate requests
    if (isFetchingProfile) {
      return profile;
    }
    
    setIsFetchingProfile(true);
    try {
      const supabase = createClient();
      
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        // Check if it's a "not found" error (expected for new users)
        // or a real database error
        if (profileError.code === 'PGRST116' || profileError.message.includes('No rows')) {
          // Profile doesn't exist - this is expected for new users
          setProfile(null);
          return null;
        }
        // Real database error - throw it
        throw new Error(`Failed to fetch profile: ${profileError.message}`);
      }

      // In DEV_MODE with mock user, if profile is null (RLS blocking or doesn't exist),
      // create a mock profile with family_id to bypass onboarding
      if (DEV_MODE && userId === MOCK_USER.id && !data) {
        const mockProfile: UserProfile = {
          id: userId,
          display_name: MOCK_USER.user_metadata.display_name || 'Test User',
          family_id: '23a92a7c-4928-42bf-b285-8e525a782452',
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setProfile(mockProfile);
        return mockProfile;
      }
      
      setProfile(data);
      return data;
    } catch (err) {
      // Don't set error state for missing profiles (expected for new users)
      // Only set error for actual database errors
      if (err instanceof Error && !err.message.includes('No rows') && !err.message.includes('PGRST116')) {
        setError(err);
      }
      return null;
    } finally {
      setIsFetchingProfile(false);
    }
  }, [isFetchingProfile, profile]);

  /**
   * Fetches user's family from families table
   * This checks if user is a member of any family (admin or member)
   */
  const fetchUserFamily = useCallback(async (userId: string) => {
    // Skip if we just fetched this user's profile
    if (lastFetchedUserIdRef.current === userId) {
      return profile;
    }
    
    lastFetchedUserIdRef.current = userId;
    
    try {
      const supabase = createClient();
      
      // In DEV_MODE with mock user ID but no real session, skip database query
      if (DEV_MODE && userId === MOCK_USER.id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setUserFamily(null);
          return null;
        }
        // If there's a real session with mock user ID, proceed to fetch family
      }
      
      // Family info is in the profile (profile.family_id)
      // We don't need to query families table separately
      // The hasFamily check uses profile.family_id
      setUserFamily(null);
      return null;
    } catch (err) {
      setUserFamily(null);
      return null;
    }
  }, [profile]);

  /**
   * Refreshes user profile (useful after creating family)
   */
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchUserFamily(user.id);
    }
  }, [user, fetchProfile, fetchUserFamily]);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        const errorMessage = mapAuthError(signInError as AuthError);
        setError(new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
      
      if (!data.user) {
        throw new Error('No user returned from sign in');
      }
      
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
        display_name: data.user.user_metadata?.display_name,
      };
      
      setUser(authUser);
      await fetchProfile(data.user.id);
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas logowania';
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });
      
      if (signUpError) {
        const errorMessage = mapAuthError(signUpError as AuthError);
        setError(new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
      
      if (!data.user) {
        throw new Error('No user returned from sign up');
      }

      // Check if email confirmation is required
      // (user exists but email_confirmed_at is null)
      if (data.user && !data.user.confirmed_at) {
        const confirmationMessage = 'Konto zostało utworzone. Sprawdź swoją skrzynkę e-mail i potwierdź adres e-mail, aby kontynuować.';
        setError(new Error(confirmationMessage));
        return { success: false, error: confirmationMessage };
      }
      
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
        display_name: data.user.user_metadata?.display_name,
      };
      
      setUser(authUser);
      
      // Try to fetch profile, but don't fail if it doesn't exist yet
      // (new users don't have a profile until they create a family)
      try {
        await fetchProfile(data.user.id);
      } catch (profileErr) {
        // Profile might not exist yet - this is expected for new users
        // Only log the error, don't fail the signup
        setProfile(null);
      }
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas rejestracji';
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  /**
   * Sign out current user
   */
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        throw new Error(signOutError.message);
      }
      
      // Clear user state immediately
      setUser(null);
      setProfile(null);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas wylogowania';
      setError(new Error(errorMessage));
      // Still clear user state even if there was an error
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Reset password - sends password reset email
   */
  const resetPassword = useCallback(async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      
      if (resetError) {
        const errorMessage = mapAuthError(resetError as AuthError);
        setError(new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas resetu hasła';
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update password after password reset
   * 
   * @param newPassword - New password to set
   * @param _token - Optional token (unused, Supabase handles token from URL hash automatically)
   */
  const updatePassword = useCallback(async (newPassword: string, _token?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createClient();
      
      // Supabase automatically handles token from URL hash
      // We just need to call updateUser with the new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (updateError) {
        const errorMessage = mapAuthError(updateError as AuthError);
        setError(new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Wystąpił błąd podczas zmiany hasła';
      setError(new Error(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize auth on mount
   */
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const initAuth = async () => {
      try {
        // Check existing session (DEV_MODE auto-login is disabled per user request)
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        if (!mounted) return;

        if (sessionUser) {
          const authUser: AuthUser = {
            id: sessionUser.id,
            email: sessionUser.email || '',
            display_name: sessionUser.user_metadata?.display_name,
          };

          setUser(authUser);
          await fetchProfile(sessionUser.id);
          await fetchUserFamily(sessionUser.id);
        } else {
          // No session - ensure loading is false
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Auth initialization failed'));
          setIsLoading(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
          display_name: session.user.user_metadata?.display_name,
        };
        setUser(authUser);
        
        // Only fetch profile on sign in or user update, not on token refresh
        // This prevents infinite loops while still allowing JWT updates
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          fetchProfile(session.user.id).catch(() => {
            // Error already handled in fetchProfile
          });
          fetchUserFamily(session.user.id).catch(() => {
            // Error already handled in fetchUserFamily
          });
        }
      } else {
        setUser(null);
        setProfile(null);
        setUserFamily(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchUserFamily]);

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    hasFamily: !!profile?.family_id || !!userFamily,
    error,
    refreshProfile,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };
}
