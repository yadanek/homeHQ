/**
 * Supabase Edge Function: analyze-event-for-suggestions
 * 
 * Analyzes event title using keyword matching to generate AI task suggestions.
 * This is the core of HomeHQ's AI engine that reduces parental mental load
 * by automatically suggesting logistical tasks based on calendar events.
 * 
 * @endpoint POST /analyze-event-for-suggestions
 * @auth Required (via Authorization header)
 */

// deno-lint-ignore-file no-explicit-any
// @ts-expect-error - Deno runtime imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error - Deno runtime imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * CORS headers for all responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Request payload for event analysis
 */
interface AnalyzeEventRequest {
  title: string;
  start_time: string;
  participant_ids?: string[];
  member_ids?: string[];
  event_id?: string;
  user_role?: 'admin' | 'member';
}

/**
 * AI-generated task suggestion
 */
interface TaskSuggestion {
  suggestion_id: string;
  title: string;
  due_date: string;
  description?: string;
}

/**
 * Response containing generated suggestions
 */
interface AnalyzeEventResponse {
  suggestions: TaskSuggestion[];
}

/**
 * AI suggestion template with keyword triggers
 */
interface SuggestionTemplate {
  id: string;
  keywords: string[];
  title: string;
  days_before: number;
  description: string;
  admin_only?: boolean;
}

/**
 * Predefined AI suggestion templates
 * 
 * These represent the initial MVP rule-based AI engine.
 * In future iterations, this will be replaced with OpenRouter.ai integration.
 */
const SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  // === BIRTHDAY EVENTS ===
  {
    id: 'birthday_invitations',
    keywords: ['urodziny', 'birthday', 'bday', 'b-day', 'urodzinki'],
    title: 'Wysłać zaproszenia / Send invitations',
    days_before: 14,
    description: 'Przygotować i wysłać zaproszenia na urodziny'
  },
  {
    id: 'birthday_cake',
    keywords: ['urodziny', 'birthday', 'bday', 'b-day', 'urodzinki'],
    title: 'Zamówić tort / Order cake',
    days_before: 7,
    description: 'Zamówić tort urodzinowy'
  },
  {
    id: 'birthday_gifts',
    keywords: ['urodziny', 'birthday', 'bday', 'b-day', 'urodzinki'],
    title: 'Kupić prezenty i dekoracje / Buy gifts',
    days_before: 14,
    description: 'Purchase birthday presents and decorations'
  },

  // === SCHOOL EVENTS ===
  {
    id: 'parent_teacher_meeting',
    keywords: ['wywiadówka', 'zebranie', 'spotkanie z nauczycielem', 'parent-teacher', 'school meeting'],
    title: 'Przejrzeć zeszyty dziecka / Review notebooks',
    days_before: 1,
    description: 'Przejrzeć zeszyty i prace dziecka przed wywiadówką'
  },
  {
    id: 'school_trip_food',
    keywords: ['wycieczka', 'school trip', 'field trip', 'wycieczka szkolna'],
    title: 'Przygotować drugie śniadanie / Pack lunch',
    days_before: 1,
    description: 'Przygotować drugie śniadanie i napój na wycieczkę'
  },
  {
    id: 'school_trip_clothes',
    keywords: ['wycieczka', 'school trip', 'field trip', 'wycieczka szkolna'],
    title: 'Spakować ubrania / Pack clothes',
    days_before: 2,
    description: 'Sprawdzić prognozę pogody i spakować odpowiednie ubrania'
  },
  {
    id: 'end_of_school_year_gift',
    keywords: ['koniec roku', 'zakończenie roku', 'end of school year', 'last day of school'],
    title: 'Prezent dla nauczyciela / Teacher gift',
    days_before: 7,
    description: 'Kupić prezent dla nauczyciela na zakończenie roku'
  },
  {
    id: 'school_year_start_supplies',
    keywords: ['początek roku', 'rozpoczęcie roku', 'first day', 'back to school', 'szkoła'],
    title: 'Kupić przybory szkolne / Buy school supplies',
    days_before: 14,
    description: 'Zakupić wszystkie przybory szkolne z listy'
  },
  {
    id: 'school_year_start_books',
    keywords: ['początek roku', 'rozpoczęcie roku', 'first day', 'back to school', 'szkoła'],
    title: 'Podpisać podręczniki / Label textbooks',
    days_before: 7,
    description: 'Podpisać wszystkie podręczniki i zeszyty'
  },
  {
    id: 'semester_end_celebration',
    keywords: ['świadectwo', 'koniec semestru', 'report card', 'semester end', 'półrocze'],
    title: 'Zaplanować świętowanie / Plan celebration',
    days_before: 1,
    description: 'Zaplanować rodzinne świętowanie zakończenia semestru'
  },
  {
    id: 'school_performance',
    keywords: ['przedstawienie', 'akademia', 'jasełka', 'performance', 'school play', 'recital'],
    title: 'Przygotować strój / Prepare costume',
    days_before: 7,
    description: 'Przygotować strój dla dziecka na przedstawienie'
  },
  {
    id: 'school_break_activities',
    keywords: ['ferie', 'wakacje', 'summer break', 'winter break', 'holiday', 'półkolonie'],
    title: 'Zapisać na zajęcia / Register for activities',
    days_before: 60,
    description: 'Zapisać dzieci na półkolonie lub zajęcia wakacyjne'
  },

  // === DATE NIGHT / OUTING ===
  {
    id: 'date_night_babysitter',
    keywords: ['cinema', 'date', 'dinner', 'movie', 'restaurant', 'kino', 'randka', 'wyjście', 'wyjscie', 'kolacja'],
    title: 'Umówić opiekunkę / Book babysitter',
    days_before: 3,
    description: 'Arrange childcare for the event',
    admin_only: true
  },
  {
    id: 'date_night_reservation',
    keywords: ['randka', 'kolacja', 'dinner', 'date night', 'restaurant', 'restauracja'],
    title: 'Zarezerwować stolik / Reserve table',
    days_before: 3,
    description: 'Zarezerwować stolik w restauracji'
  },

  // === HEALTH ===
  {
    id: 'health_documents',
    keywords: ['doctor', 'dentist', 'clinic', 'checkup', 'medical', 'appointment', 'lekarz', 'dentysta', 'pediatra', 'wizyta'],
    title: 'Przygotować dokumenty / Prepare documents',
    days_before: 1,
    description: 'Gather insurance cards, vaccination records and medical history'
  },

  // === TRAVEL ===
  {
    id: 'travel_pack',
    keywords: ['flight', 'trip', 'vacation', 'holiday', 'travel', 'airport', 'lot', 'wyjazd', 'urlop'],
    title: 'Spakować walizki / Pack bags',
    days_before: 2,
    description: 'Prepare luggage and travel essentials'
  },
  {
    id: 'travel_documents',
    keywords: ['wakacje', 'vacation', 'holiday', 'trip', 'urlop', 'wyjazd', 'family vacation'],
    title: 'Sprawdzić dokumenty / Check documents',
    days_before: 30,
    description: 'Sprawdzić ważność dowodów osobistych i paszportów dzieci'
  },

  // === HOLIDAYS ===
  {
    id: 'christmas_gifts',
    keywords: ['wigilia', 'boże narodzenie', 'christmas', 'święta', 'xmas', 'gwiazdka'],
    title: 'Kupić prezenty / Buy presents',
    days_before: 30,
    description: 'Kupić prezenty świąteczne dla dzieci'
  },
  {
    id: 'christmas_outfits',
    keywords: ['wigilia', 'boże narodzenie', 'christmas', 'święta', 'choinka'],
    title: 'Przygotować stroje / Prepare outfits',
    days_before: 7,
    description: 'Przygotować odświętne stroje na Wigilię'
  },

  // === COSTUME PARTIES ===
  {
    id: 'costume_party',
    keywords: ['bal', 'przebieraniec', 'halloween', 'costume', 'przebranie', 'kostium', 'andrzejki', 'karnawał'],
    title: 'Przygotować kostium / Prepare costume',
    days_before: 14,
    description: 'Przygotować lub kupić kostium na bal'
  },

  // === SPORTS & ACTIVITIES ===
  {
    id: 'swimming_bag',
    keywords: ['basen', 'swimming', 'pool', 'pływalnia', 'zajęcia sportowe', 'sport', 'trening'],
    title: 'Spakować torbę / Pack sports bag',
    days_before: 1,
    description: 'Spakować torbę z kostiumem, ręcznikiem i przyborami'
  }
];

/**
 * Calculates due date by subtracting days from event start time
 */
function calculateDueDate(startTime: string, daysBefore: number): string {
  const eventDate = new Date(startTime);
  const dueDate = new Date(eventDate);
  dueDate.setDate(dueDate.getDate() - daysBefore);
  return dueDate.toISOString();
}

/**
 * Normalizes text for keyword matching
 * Converts to lowercase and removes extra whitespace
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Checks if any keyword from template matches the event title
 */
function matchesKeywords(title: string, keywords: string[]): boolean {
  const normalizedTitle = normalizeText(title);
  return keywords.some(keyword => normalizedTitle.includes(keyword.toLowerCase()));
}

/**
 * Main handler for the Edge Function
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: { 
          code: 'METHOD_NOT_ALLOWED', 
          message: 'Only POST method is allowed' 
        } 
      }),
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }

  try {
    // Get environment variables (needed for both auth and database operations)
    // @ts-expect-error - Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-expect-error - Deno global
    // Try custom VITE_SUPABASE_ANON_KEY first, fallback to system SUPABASE_ANON_KEY
    const customAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY');
    // @ts-expect-error - Deno global
    const systemAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseAnonKey = customAnonKey || systemAnonKey;
    
    console.log('[Edge Function] Environment check:', {
      hasCustomKey: !!customAnonKey,
      hasSystemKey: !!systemAnonKey,
      usingKey: customAnonKey ? 'VITE_SUPABASE_ANON_KEY' : 'SUPABASE_ANON_KEY',
      keyPreview: supabaseAnonKey?.substring(0, 20) + '...'
    });
    
    // @ts-expect-error - Deno global
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // === AUTHENTICATION: Verify JWT token ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Edge Function] Missing Authorization header');
      return new Response(
        JSON.stringify({ 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Missing authorization header' 
          } 
        }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    console.log('[Edge Function] Auth header received:', authHeader.substring(0, 30) + '...');

    // Verify JWT token by creating client with user's token
    const authClient = createClient(supabaseUrl, supabaseAnonKey!, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
    if (authError || !user) {
      console.error('[Edge Function] JWT verification failed:', {
        error: authError,
        errorMessage: authError?.message,
        errorStatus: authError?.status
      });
      return new Response(
        JSON.stringify({ 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Invalid or expired token' 
          } 
        }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    console.log('[Edge Function] User authenticated:', user.id);
    
    // Parse request body
    const { 
      title, 
      start_time, 
      participant_ids = [], 
      member_ids = [],
      event_id,
      user_role = 'member' 
    } = await req.json() as AnalyzeEventRequest;

    // Validate required fields
    if (!title || !start_time) {
      return new Response(
        JSON.stringify({ 
          error: { 
            code: 'INVALID_INPUT', 
            message: 'title and start_time are required' 
          } 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Validate start_time is valid ISO 8601
    const eventDate = new Date(start_time);
    if (isNaN(eventDate.getTime())) {
      return new Response(
        JSON.stringify({ 
          error: { 
            code: 'INVALID_INPUT', 
            message: 'start_time must be a valid ISO 8601 timestamp' 
          } 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Initialize Supabase client with SERVICE_ROLE_KEY for database operations
    // (We already verified JWT above, now we need elevated permissions for DB queries)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch participant details for advanced rules
    let participants: Array<{ 
      profile_id: string | null; 
      member_id: string | null; 
      role?: string; 
      is_admin?: boolean 
    }> = [];

    if (event_id) {
      // Fetch from database if event_id provided
      const { data: participantsData } = await supabase
        .from('event_participants')
        .select(`
          profile_id,
          member_id,
          profile:profiles(id, role),
          member:family_members(id, is_admin)
        `)
        .eq('event_id', event_id);

      if (participantsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        participants = participantsData.map((p: any) => ({
          profile_id: p.profile_id,
          member_id: p.member_id,
          role: p.profile?.role,
          is_admin: p.member?.is_admin
        }));
      }
    } else if (participant_ids.length > 0 || member_ids.length > 0) {
      // Build from provided IDs for preview mode
      for (const profileId of participant_ids) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', profileId)
          .single();
        
        if (profile) {
          participants.push({
            profile_id: profile.id,
            member_id: null,
            role: profile.role as 'admin' | 'member',
            is_admin: undefined
          });
        }
      }

      for (const memberId of member_ids) {
        // Type assertion for custom table not in generated types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const familyMembersTable = 'family_members' as any;
        const { data: member } = await supabase
          .from(familyMembersTable)
          .select('id, is_admin')
          .eq('id', memberId)
          .single();
        
        if (member) {
          participants.push({
            profile_id: null,
            member_id: member.id,
            role: undefined,
            is_admin: member.is_admin
          });
        }
      }
    }

    // Generate suggestions based on keyword matching
    const suggestions: TaskSuggestion[] = [];

    for (const template of SUGGESTION_TEMPLATES) {
      // Special handling for "date_night_babysitter" template
      if (template.id === 'date_night_babysitter') {
        // Only suggest babysitter if event matches date night/outing keywords
        if (!matchesKeywords(title, template.keywords)) {
          continue;
        }

        // Get user's family_id to fetch all family members
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('id', user.id)
          .single();

        if (!userProfile?.family_id) {
          continue;
        }

        // Fetch all children in the family (family_members with is_admin = false)
        const { data: allFamilyChildren } = await supabase
          .from('family_members')
          .select('id, is_admin')
          .eq('family_id', userProfile.family_id)
          .eq('is_admin', false);

        // If there are no children in the family, skip babysitter suggestion
        if (!allFamilyChildren || allFamilyChildren.length === 0) {
          continue;
        }

        // Check which children are NOT participating in the event
        const participatingChildrenIds = participants
          .filter(p => p.member_id && p.is_admin === false)
          .map(p => p.member_id);
        
        const nonParticipatingChildren = allFamilyChildren.filter(
          (child: any) => !participatingChildrenIds.includes(child.id)
        );

        // Check if there are adults participating
        const hasAdultParticipants = participants.some(
          p => (p.profile_id && p.role === 'admin') || (p.member_id && p.is_admin === true)
        );

        // Suggest babysitter if:
        // 1. There are children in the family who are NOT attending
        // 2. There are adults who ARE attending
        if (nonParticipatingChildren.length > 0 && hasAdultParticipants) {
          suggestions.push({
            suggestion_id: template.id,
            title: template.title,
            due_date: calculateDueDate(start_time, template.days_before),
            description: template.description
          });
        }
        continue;
      }

      // Standard handling for other templates
      // Skip admin-only suggestions for non-admin users
      if (template.admin_only && user_role !== 'admin') {
        continue;
      }

      // Check if event title matches any keywords
      if (matchesKeywords(title, template.keywords)) {
        suggestions.push({
          suggestion_id: template.id,
          title: template.title,
          due_date: calculateDueDate(start_time, template.days_before),
          description: template.description
        });
      }
    }

    // Return suggestions (empty array if no matches)
    return new Response(
      JSON.stringify({ suggestions } as AnalyzeEventResponse),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );

  } catch (error) {
    // Log error for debugging (Deno runtime)
    // eslint-disable-next-line no-console
    console.error('AI suggestion engine error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: { 
          code: 'AI_ENGINE_ERROR', 
          message: error instanceof Error ? error.message : 'Internal server error' 
        } 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
});

