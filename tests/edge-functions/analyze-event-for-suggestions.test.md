# Edge Function Test Plan: analyze-event-for-suggestions

## Overview

Test plan for the AI suggestion engine Edge Function.
This function analyzes event titles using keyword matching to generate task suggestions.

**Function**: `analyze-event-for-suggestions`  
**Location**: `supabase/functions/analyze-event-for-suggestions/index.ts`  
**Type**: Supabase Edge Function (Deno runtime)

## Test Environment Setup

### Local Testing with Supabase CLI

```bash
# Start Supabase locally
supabase start

# Deploy function locally
supabase functions deploy analyze-event-for-suggestions --no-verify-jwt

# Test function
supabase functions invoke analyze-event-for-suggestions \
  --data '{
    "title": "Doctor appointment",
    "start_time": "2026-02-01T10:00:00Z",
    "user_role": "admin"
  }'
```

### Manual Testing with curl

```bash
# Set your Supabase URL and anon key
export SUPABASE_URL="your-project-url"
export SUPABASE_ANON_KEY="your-anon-key"

# Test endpoint
curl -X POST "${SUPABASE_URL}/functions/v1/analyze-event-for-suggestions" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Doctor appointment",
    "start_time": "2026-02-01T10:00:00Z"
  }'
```

## Test Cases

### 1. Birthday Keyword Matching

**Input**:
```json
{
  "title": "Sarah's Birthday Party",
  "start_time": "2026-02-15T15:00:00Z",
  "user_role": "admin"
}
```

**Expected Output**:
```json
{
  "suggestions": [
    {
      "suggestion_id": "birthday",
      "title": "Buy a gift",
      "due_date": "2026-02-08T15:00:00Z",
      "description": "Purchase birthday present"
    }
  ]
}
```

**Validation**:
- ✅ Suggestion ID is "birthday"
- ✅ Due date is 7 days before event
- ✅ Title and description match template

### 2. Health Keyword Matching

**Input**:
```json
{
  "title": "Dentist appointment for kids",
  "start_time": "2026-02-10T10:00:00Z",
  "user_role": "member"
}
```

**Expected Output**:
```json
{
  "suggestions": [
    {
      "suggestion_id": "health",
      "title": "Prepare medical documents",
      "due_date": "2026-02-09T10:00:00Z",
      "description": "Gather insurance cards and medical history"
    }
  ]
}
```

**Validation**:
- ✅ Suggestion ID is "health"
- ✅ Due date is 1 day before event
- ✅ Works for "doctor", "dentist", "clinic" keywords

### 3. Outing Keyword Matching (Admin Only)

**Input (Admin)**:
```json
{
  "title": "Date night at cinema",
  "start_time": "2026-02-20T19:00:00Z",
  "user_role": "admin"
}
```

**Expected Output**:
```json
{
  "suggestions": [
    {
      "suggestion_id": "outing",
      "title": "Book a babysitter",
      "due_date": "2026-02-17T19:00:00Z",
      "description": "Arrange childcare for the event"
    }
  ]
}
```

**Input (Member)**:
```json
{
  "title": "Date night at cinema",
  "start_time": "2026-02-20T19:00:00Z",
  "user_role": "member"
}
```

**Expected Output**:
```json
{
  "suggestions": []
}
```

**Validation**:
- ✅ Outing suggestion only generated for admins
- ✅ Due date is 3 days before event
- ✅ Works for "cinema", "date", "dinner" keywords

### 4. Travel Keyword Matching

**Input**:
```json
{
  "title": "Flight to Paris",
  "start_time": "2026-03-01T08:00:00Z",
  "user_role": "admin"
}
```

**Expected Output**:
```json
{
  "suggestions": [
    {
      "suggestion_id": "travel",
      "title": "Pack bags",
      "due_date": "2026-02-27T08:00:00Z",
      "description": "Prepare luggage and travel essentials"
    }
  ]
}
```

**Validation**:
- ✅ Suggestion ID is "travel"
- ✅ Due date is 2 days before event
- ✅ Works for "flight", "trip", "vacation" keywords

### 5. Multiple Keywords

**Input**:
```json
{
  "title": "Doctor appointment before vacation trip",
  "start_time": "2026-03-15T10:00:00Z",
  "user_role": "admin"
}
```

**Expected Output**:
```json
{
  "suggestions": [
    {
      "suggestion_id": "health",
      "title": "Prepare medical documents",
      "due_date": "2026-03-14T10:00:00Z",
      "description": "Gather insurance cards and medical history"
    },
    {
      "suggestion_id": "travel",
      "title": "Pack bags",
      "due_date": "2026-03-13T10:00:00Z",
      "description": "Prepare luggage and travel essentials"
    }
  ]
}
```

**Validation**:
- ✅ Multiple suggestions generated
- ✅ Each suggestion has correct due date
- ✅ Suggestions are distinct

### 6. No Keyword Matches

**Input**:
```json
{
  "title": "Team Meeting",
  "start_time": "2026-02-01T10:00:00Z",
  "user_role": "admin"
}
```

**Expected Output**:
```json
{
  "suggestions": []
}
```

**Validation**:
- ✅ Empty array returned
- ✅ No errors thrown

### 7. Case Insensitivity

**Input**:
```json
{
  "title": "DOCTOR APPOINTMENT",
  "start_time": "2026-02-01T10:00:00Z"
}
```

**Expected Output**:
- ✅ Health suggestion generated
- ✅ Uppercase title matched correctly

### 8. Missing Required Fields

**Input**:
```json
{
  "title": "Meeting"
}
```

**Expected Output**:
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "title and start_time are required"
  }
}
```

**Validation**:
- ✅ HTTP 400 status
- ✅ Error message is clear

### 9. Invalid ISO 8601 Date

**Input**:
```json
{
  "title": "Meeting",
  "start_time": "invalid-date"
}
```

**Expected Output**:
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "start_time must be a valid ISO 8601 timestamp"
  }
}
```

**Validation**:
- ✅ HTTP 400 status
- ✅ Validation error caught

### 10. CORS Headers

**Request Method**: OPTIONS

**Expected Response**:
- ✅ HTTP 204 status
- ✅ `Access-Control-Allow-Origin: *`
- ✅ `Access-Control-Allow-Methods: POST, OPTIONS`
- ✅ `Access-Control-Allow-Headers` includes authorization

### 11. Invalid HTTP Method

**Request Method**: GET

**Expected Output**:
```json
{
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Only POST method is allowed"
  }
}
```

**Validation**:
- ✅ HTTP 405 status

## Performance Tests

### Response Time Benchmarks

| Scenario | Expected Time | Max Acceptable |
|----------|--------------|----------------|
| Simple keyword match | < 50ms | 100ms |
| Multiple keywords | < 100ms | 200ms |
| No matches | < 30ms | 50ms |
| Validation error | < 10ms | 20ms |

### Load Testing

```bash
# Use Apache Bench or similar tool
ab -n 1000 -c 10 \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -p test-payload.json \
  "${SUPABASE_URL}/functions/v1/analyze-event-for-suggestions"
```

**Expected**:
- ✅ 99% of requests complete within 200ms
- ✅ 0% error rate
- ✅ Handles 100 concurrent requests

## Integration Tests

### Test with Real Database Event Creation

```typescript
// Test creating event with suggestions end-to-end
const createEventResult = await createEvent({
  title: "Doctor appointment",
  start_time: "2026-02-01T10:00:00Z",
  end_time: "2026-02-01T11:00:00Z",
  is_private: false,
  accept_suggestions: ['health']
});

// Verify
expect(createEventResult.suggestions).toHaveLength(1);
expect(createEventResult.suggestions[0].suggestion_id).toBe('health');
expect(createEventResult.created_tasks).toHaveLength(1);
```

## Monitoring in Production

### Metrics to Track

1. **Invocation Count**: Total function calls per day
2. **Response Time**: P50, P95, P99 percentiles
3. **Error Rate**: % of failed invocations
4. **Suggestion Distribution**: Count by suggestion type
5. **Keyword Match Rate**: % of events generating suggestions

### Logging

Function logs include:
```typescript
console.log('AI suggestion generated', {
  title,
  suggestions: suggestions.map(s => s.suggestion_id),
  user_role,
  timestamp: new Date().toISOString()
});
```

View logs in Supabase dashboard:
```bash
supabase functions logs analyze-event-for-suggestions
```

## Troubleshooting

### Common Issues

1. **No suggestions generated**
   - Check keyword spelling in templates
   - Verify case-insensitive matching
   - Review title normalization

2. **Incorrect due dates**
   - Verify `days_before` calculation
   - Check timezone handling
   - Validate ISO 8601 parsing

3. **CORS errors**
   - Ensure headers are set in response
   - Check preflight OPTIONS handling
   - Verify allowed origins

## Future Test Considerations

### Phase 2: OpenRouter.ai Integration

When replacing keyword matching with LLM:

1. **Mocking LLM Responses**: Create fixtures for consistent testing
2. **Rate Limiting**: Test API quota handling
3. **Latency**: Monitor P95 with external API calls
4. **Fallback**: Test keyword matching as backup when LLM fails
5. **Cost Tracking**: Monitor API usage and costs

---

**Status**: ✅ Test plan ready for execution  
**Last Updated**: 2026-01-26  
**Next Review**: After Phase 2 implementation


