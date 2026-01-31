import { createClient as createSupabaseClient, SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { DEV_MODE, wrapSupabaseWithMockAuth } from '@/lib/mockAuth';

// Export SupabaseClient type with Database schema
export type SupabaseClient = SupabaseClientType<Database>;

// Validate environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// Singleton Supabase client instance
// This prevents multiple GoTrueClient instances from being created
let supabaseInstance: SupabaseClient | null = null;

/**
 * Gets or creates the singleton Supabase client instance
 * 
 * Use this function to get a shared client instance across the app.
 * This prevents multiple GoTrueClient instances and avoids warnings.
 * 
 * In DEV_MODE, automatically wraps client with mock auth for easier development.
 * 
 * @returns Configured Supabase client with Database types
 */
export function createClient(): SupabaseClient {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  const client = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  
  // In DEV mode, wrap with mock auth but still use real database
  if (DEV_MODE) {
    supabaseInstance = wrapSupabaseWithMockAuth(client);
  } else {
    supabaseInstance = client;
  }
  
  // At this point supabaseInstance is guaranteed to be non-null
  return supabaseInstance as SupabaseClient;
}

// Create default Supabase client for general use
export const supabase = createClient();

