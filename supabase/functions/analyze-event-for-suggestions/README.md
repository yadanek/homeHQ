# Edge Function: analyze-event-for-suggestions

## Overview

AI suggestion engine that analyzes event titles using keyword matching to generate task suggestions. This function is the core of HomeHQ's automated task generation feature.

**Function Name**: `analyze-event-for-suggestions`  
**Runtime**: Deno (Supabase Edge Functions)  
**Authentication**: Required (via Authorization header)

## Functionality

### Keyword Matching Rules

| Suggestion Type | Keywords | Generated Task | Days Before Event |
|----------------|----------|----------------|-------------------|
| **Birthday** | birthday, bday, b-day | Buy a gift | 7 |
| **Health** | doctor, dentist, clinic, checkup, medical | Prepare medical documents | 1 |
| **Outing** | cinema, date, dinner, movie, restaurant | Book a babysitter | 3 (admin only) |
| **Travel** | flight, trip, vacation, holiday, travel, airport | Pack bags | 2 |

### Features

- **Case-insensitive matching**: "DOCTOR" matches "doctor"
- **Partial word matching**: "dentist appointment" matches "dentist"
- **Role-based suggestions**: Outing suggestions only for admins
- **Multiple suggestions**: One event can trigger multiple suggestions
- **Automatic due date calculation**: Based on event start time and days before

## API

### Request

```typescript
POST /functions/v1/analyze-event-for-suggestions

Headers:
  Authorization: Bearer {anon_key}
  Content-Type: application/json

Body:
{
  "title": string,           // Required: Event title to analyze
  "start_time": string,      // Required: ISO 8601 timestamp
  "participant_ids"?: string[],  // Optional: Array of profile UUIDs
  "user_role"?: "admin" | "member"  // Optional: User role (default: "member")
}
```

### Response

**Success (200 OK)**:
```json
{
  "suggestions": [
    {
      "suggestion_id": "health",
      "title": "Prepare medical documents",
      "due_date": "2026-01-31T10:00:00Z",
      "description": "Gather insurance cards and medical history"
    }
  ]
}
```

**Validation Error (400 Bad Request)**:
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "title and start_time are required"
  }
}
```

**Server Error (500 Internal Server Error)**:
```json
{
  "error": {
    "code": "AI_ENGINE_ERROR",
    "message": "Internal server error"
  }
}
```

## Deployment

### Local Development

```bash
# Start Supabase locally
supabase start

# Deploy function locally
supabase functions deploy analyze-event-for-suggestions --no-verify-jwt

# Test locally
curl -X POST http://localhost:54321/functions/v1/analyze-event-for-suggestions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Doctor appointment",
    "start_time": "2026-02-01T10:00:00Z"
  }'
```

### Production Deployment

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy to production
supabase functions deploy analyze-event-for-suggestions

# Test production
supabase functions invoke analyze-event-for-suggestions \
  --data '{
    "title": "Doctor appointment",
    "start_time": "2026-02-01T10:00:00Z"
  }'
```

### Environment Variables

No environment variables required for current implementation.

Future integration with OpenRouter.ai will require:
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (e.g., "meta-llama/llama-3-70b-instruct")

## Testing

### Manual Testing

See `tests/edge-functions/analyze-event-for-suggestions.test.md` for complete test plan.

**Quick Test**:
```bash
# Test birthday suggestion
supabase functions invoke analyze-event-for-suggestions \
  --data '{"title":"Birthday party","start_time":"2026-02-15T15:00:00Z"}'

# Test health suggestion
supabase functions invoke analyze-event-for-suggestions \
  --data '{"title":"Dentist appointment","start_time":"2026-02-10T10:00:00Z"}'

# Test admin-only outing suggestion
supabase functions invoke analyze-event-for-suggestions \
  --data '{"title":"Date night at cinema","start_time":"2026-02-20T19:00:00Z","user_role":"admin"}'

# Test travel suggestion
supabase functions invoke analyze-event-for-suggestions \
  --data '{"title":"Flight to Paris","start_time":"2026-03-01T08:00:00Z"}'
```

### Performance

- **Target response time**: < 100ms
- **Max response time**: 200ms
- **Cold start**: < 500ms

### Monitoring

View logs in Supabase dashboard or CLI:
```bash
supabase functions logs analyze-event-for-suggestions --follow
```

## Implementation Details

### Algorithm

1. **Normalize title**: Convert to lowercase, trim whitespace
2. **Iterate suggestion templates**: Check each keyword pattern
3. **Role filtering**: Skip admin-only suggestions for non-admins
4. **Match keywords**: Check if any keyword appears in title
5. **Calculate due date**: Subtract days_before from start_time
6. **Build suggestion**: Create suggestion object with calculated due date
7. **Return results**: Send JSON array of suggestions

### Code Structure

```
index.ts
├── Interfaces (TypeScript types)
├── SUGGESTION_TEMPLATES (Keyword rules)
├── Helper Functions
│   ├── calculateDueDate()
│   ├── normalizeText()
│   └── matchesKeywords()
└── Main Handler (serve)
    ├── CORS preflight handling
    ├── Input validation
    ├── Suggestion generation
    └── Response formatting
```

## Maintenance

### Adding New Suggestion Types

1. Add template to `SUGGESTION_TEMPLATES`:
```typescript
{
  id: 'new-type',
  keywords: ['keyword1', 'keyword2'],
  title: 'Task title',
  days_before: 5,
  description: 'Task description',
  admin_only: false  // Optional
}
```

2. Update type definition in `src/types.ts`:
```typescript
export type SuggestionId = 'birthday' | 'health' | 'outing' | 'travel' | 'new-type';
```

3. Update validation schema in `src/validations/events.schema.ts`:
```typescript
z.enum(['birthday', 'health', 'outing', 'travel', 'new-type'])
```

4. Redeploy function:
```bash
supabase functions deploy analyze-event-for-suggestions
```

### Updating Keywords

Simply modify the `keywords` array in `SUGGESTION_TEMPLATES` and redeploy.

## Future Enhancements

### Phase 2: OpenRouter.ai Integration

Replace keyword matching with LLM-based analysis:

1. **Add API client**:
```typescript
import { OpenRouter } from 'openrouter-api';

const client = new OpenRouter(Deno.env.get('OPENROUTER_API_KEY'));
```

2. **Call LLM**:
```typescript
const response = await client.chat.completions.create({
  model: 'meta-llama/llama-3-70b-instruct',
  messages: [{
    role: 'user',
    content: `Analyze this event and suggest tasks: "${title}"`
  }]
});
```

3. **Parse LLM response**:
```typescript
const suggestions = parseLLMResponse(response.choices[0].message.content);
```

4. **Fallback to keywords**: If LLM fails, use existing keyword matching

### Phase 3: Context-Aware Suggestions

Analyze additional context:
- Previous events from same family
- Task completion patterns
- Participant preferences
- Time of year (holidays, seasons)

## Troubleshooting

### No suggestions generated

**Check**:
1. Title contains matching keywords
2. Keywords are spelled correctly
3. For outing suggestions, user_role is "admin"

**Debug**:
```typescript
console.log('Normalized title:', normalizeText(title));
console.log('Template keywords:', template.keywords);
```

### Incorrect due dates

**Check**:
1. start_time is valid ISO 8601
2. Timezone is correct
3. days_before calculation is accurate

**Debug**:
```typescript
console.log('Event date:', new Date(start_time));
console.log('Due date:', calculateDueDate(start_time, days_before));
```

### CORS errors

**Check**:
1. CORS headers are set in response
2. OPTIONS method is handled
3. Authorization header is allowed

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-26  
**Maintainer**: HomeHQ Dev Team


