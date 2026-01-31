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
  {
    id: 'birthday',
    keywords: ['birthday', 'bday', 'b-day'],
    title: 'Buy a gift',
    days_before: 7,
    description: 'Purchase birthday present'
  },
  {
    id: 'health',
    keywords: ['doctor', 'dentist', 'clinic', 'checkup', 'medical', 'appointment'],
    title: 'Prepare medical documents',
    days_before: 1,
    description: 'Gather insurance cards and medical history'
  },
  {
    id: 'outing',
    keywords: ['cinema', 'date', 'dinner', 'movie', 'restaurant'],
    title: 'Book a babysitter',
    days_before: 3,
    description: 'Arrange childcare for the event',
    admin_only: true
  },
  {
    id: 'travel',
    keywords: ['flight', 'trip', 'vacation', 'holiday', 'travel', 'airport'],
    title: 'Pack bags',
    days_before: 2,
    description: 'Prepare luggage and travel essentials'
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
      // Special handling for "outing" template
      if (template.id === 'outing') {
        // Only suggest babysitter if event matches outing keywords
        if (!matchesKeywords(title, template.keywords)) {
          continue;
        }

        // Check if all participants are admins (adults)
        const profileParticipants = participants.filter(p => p.profile_id);
        const memberParticipants = participants.filter(p => p.member_id);
        
        const allProfilesAreAdmins = profileParticipants.length === 0 || 
          profileParticipants.every(p => p.role === 'admin');
        const allMembersAreAdmins = memberParticipants.length === 0 || 
          memberParticipants.every(p => p.is_admin === true);
        
        // Only suggest babysitter if ALL participants are admins
        // (meaning no children are attending, so they need a babysitter)
        if (allProfilesAreAdmins && allMembersAreAdmins) {
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

