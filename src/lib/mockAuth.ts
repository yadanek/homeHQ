/**
 * Mock Authentication for Development
 * 
 * Temporary bypass dla autentykacji podczas developmentu.
 * Używa prawdziwego Supabase client, ale mockuje tylko auth.getUser()
 * 
 * SETUP:
 * 1. Stwórz test usera w Supabase Dashboard (Authentication > Users)
 * 2. Wklej jego UUID poniżej
 * 3. Ten user będzie używany do wszystkich operacji podczas developmentu
 */

import { addMockEvent, addMockTask } from './mockData';

// DEV_MODE: Set to true to enable development features
// Auto-login is disabled - use real authentication flow
// To quickly switch between dev and prod, change this flag
export const DEV_MODE = false; // Set to false for production

// UWAGA: Wklej prawdziwy UUID z Supabase Dashboard!
// WAŻNE: Ten użytkownik musi mieć ustawione hasło w Supabase!

export const MOCK_USER = {
  id: '2991ee00-0e73-4ee8-abf8-d454f2b6d8e0', 
  email: 'test@example.com',
  password: 'Test123456!', // Hasło do logowania (NIE używaj w produkcji!)
  user_metadata: {
    // BEZ family_id - user dopiero stworzy rodzinę
    display_name: 'Test User'
  }
};

export const MOCK_SESSION = {
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  expires_in: 3600
};

/**
 * Tworzy wrapper dla prawdziwego Supabase client który mockuje tylko auth
 * Wszystkie operacje na bazie danych są prawdziwe!
 * 
 * WAŻNE: Nie używamy spread operator, ponieważ nie kopiuje poprawnie metod.
 * Zamiast tego bezpośrednio nadpisujemy tylko obiekt auth.
 */
export function wrapSupabaseWithMockAuth(realSupabase: any) {
  // Zachowaj oryginalne metody auth
  const originalGetUser = realSupabase.auth.getUser.bind(realSupabase.auth);
  const originalGetSession = realSupabase.auth.getSession.bind(realSupabase.auth);
  
  // W DEV_MODE, używamy prawdziwej autoryzacji (signInWithPassword dostaje prawdziwy token)
  // ale mockujemy getUser() TYLKO jeśli nie ma aktywnej sesji
  
  realSupabase.auth.getUser = async () => {
    // Najpierw sprawdź czy jest aktywna sesja
    const sessionResult = await originalGetSession();
    
    // Jeśli jest aktywna sesja, zawsze używaj prawdziwego getUser
    // nawet jeśli zwraca null (może być opóźnienie w inicjalizacji)
    if (sessionResult.data?.session) {
      const realResult = await originalGetUser();
      
      // Jeśli getUser zwraca użytkownika, użyj go
      if (realResult.data?.user) {
        console.log('[DEV MODE] Real user found:', realResult.data.user.id);
        return realResult;
      }
      
      // Jeśli jest sesja ale getUser zwraca null, zwróć null zamiast mocka
      // To zapobiega nadpisywaniu nowo zarejestrowanych użytkowników
      console.log('[DEV MODE] Active session but no user yet, returning null');
      return {
        data: { user: null },
        error: null
      };
    }
    
    // Tylko jeśli NIE MA aktywnej sesji, zwróć mock usera
    // To jest pomocne tylko podczas developmentu gdy nie jesteś zalogowany
    console.log('[DEV MODE] No active session, returning mock:', MOCK_USER.id);
    return {
      data: { user: MOCK_USER },
      error: null
    };
  };
  
  // getSession() używa prawdziwej implementacji - musi zwracać prawdziwy JWT token!
  // NIE mockujemy tej metody wcale
  realSupabase.auth.getSession = originalGetSession;
  
  // Wszystkie inne metody auth (signInWithPassword, signOut, etc.) 
  // pozostają niezmienione i działają prawdziwie
  
  // Zwróć zmodyfikowany oryginalny obiekt
  return realSupabase;
}

/**
 * LEGACY: Pełny mock client dla całkowitego offline developmentu
 * Używaj tylko gdy nie masz dostępu do Supabase
 */
export function createMockSupabaseClient() {
  console.warn('[DEV MODE] Using FULL MOCK client - no real database connection!');
  
  return {
    auth: {
      getUser: async () => ({
        data: { user: MOCK_USER },
        error: null
      }),
      getSession: async () => ({
        data: { 
          session: {
            ...MOCK_SESSION,
            user: MOCK_USER
          }
        },
        error: null
      })
    },
    from: (table: string) => {
      console.log(`[MOCK] Accessing table: ${table}`);
      
      return {
        insert: (data: any) => ({
          select: () => ({
            single: async () => {
              console.log(`[MOCK] Insert into ${table}:`, data);
              
              // Mock response based on table
              if (table === 'events') {
                const mockEvent = {
                  id: `event-${Date.now()}`,
                  ...data,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  archived_at: null
                };
                
                // Store event in mock data
                addMockEvent({
                  ...mockEvent,
                  created_by_name: MOCK_USER.user_metadata.display_name,
                  participants: []
                });
                
                return {
                  data: mockEvent,
                  error: null
                };
              }
              
              if (table === 'tasks') {
                const mockTask = {
                  id: `task-${Date.now()}`,
                  ...data,
                  is_completed: false,
                  completed_at: null,
                  completed_by: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  archived_at: null
                };
                
                // Store task in mock data
                addMockTask({
                  ...mockTask,
                  created_by_name: MOCK_USER.user_metadata.display_name,
                  assigned_to_name: null,
                  completed_by_name: null,
                  event_title: null
                });
                
                return {
                  data: mockTask,
                  error: null
                };
              }
              
              return { data: { id: `${table}-${Date.now()}`, ...data }, error: null };
            }
          })
        }),
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            single: async () => {
              console.log(`[MOCK] Select from ${table} where ${column} = ${value}`);
              return {
                data: {
                  id: value,
                  event_participants: [],
                  participants: []
                },
                error: null
              };
            },
            is: (column: string, value: any) => ({
              order: (column: string, options?: any) => ({
                range: (from: number, to: number) => Promise.resolve({
                  data: [],
                  error: null,
                  count: 0
                })
              })
            })
          }),
          is: (column: string, value: any) => ({
            order: (column: string, options?: any) => ({
              range: (from: number, to: number) => Promise.resolve({
                data: [],
                error: null,
                count: 0
              })
            })
          }),
          order: (column: string, options?: any) => ({
            range: (from: number, to: number) => Promise.resolve({
              data: [],
              error: null,
              count: 0
            })
          })
        }),
        update: (updateData: any) => ({
          eq: (column: string, value: any) => ({
            is: (nullColumn: string, nullValue: any) => ({
              select: (columns?: string) => ({
                maybeSingle: async () => {
                  console.log(`[MOCK] Update ${table} where ${column} = ${value} and ${nullColumn} IS ${nullValue}:`, updateData);
                  
                  // Mock soft delete for events
                  if (table === 'events' && updateData.archived_at) {
                    // Simulate successful soft delete
                    return {
                      data: { id: value },
                      error: null
                    };
                  }
                  
                  return {
                    data: { id: value, ...updateData },
                    error: null
                  };
                }
              })
            })
          })
        }),
        delete: () => ({
          eq: (column: string, value: any) => Promise.resolve({
            data: null,
            error: null
          })
        })
      };
    },
    functions: {
      invoke: async (functionName: string, options?: any) => {
        console.log(`[MOCK] Invoke function: ${functionName}`, options?.body);
        
        if (functionName === 'analyze-event-for-suggestions') {
          const { title } = options?.body || {};
          const suggestions = [];
          
          // Mock keyword matching
          const titleLower = title?.toLowerCase() || '';
          
          if (titleLower.includes('doctor') || titleLower.includes('dentist')) {
            suggestions.push({
              suggestion_id: 'health',
              title: 'Prepare medical documents',
              due_date: new Date(Date.now() + 86400000).toISOString(), // +1 day
              description: 'Gather insurance cards and medical history'
            });
          }
          
          if (titleLower.includes('birthday') || titleLower.includes('bday')) {
            suggestions.push({
              suggestion_id: 'birthday',
              title: 'Buy a gift',
              due_date: new Date(Date.now() + 604800000).toISOString(), // +7 days
              description: 'Purchase birthday present'
            });
          }
          
          if (titleLower.includes('flight') || titleLower.includes('trip') || titleLower.includes('vacation')) {
            suggestions.push({
              suggestion_id: 'travel',
              title: 'Pack bags',
              due_date: new Date(Date.now() + 172800000).toISOString(), // +2 days
              description: 'Prepare luggage and travel essentials'
            });
          }
          
          if (titleLower.includes('cinema') || titleLower.includes('date') || titleLower.includes('dinner')) {
            suggestions.push({
              suggestion_id: 'outing',
              title: 'Book a babysitter',
              due_date: new Date(Date.now() + 259200000).toISOString(), // +3 days
              description: 'Arrange childcare for the event'
            });
          }
          
          return {
            data: { suggestions },
            error: null
          };
        }
        
        return { data: null, error: null };
      }
    }
  } as any;
}

