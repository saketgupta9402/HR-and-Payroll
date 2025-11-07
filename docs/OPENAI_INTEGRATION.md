# OpenAI Integration Guide

This document explains how OpenAI has been integrated into the Petal HR Suite system.

## Overview

OpenAI has been integrated to provide AI-powered features including:
- **AI Chat Assistant** - Streaming chat interface for HR-related queries
- **Enhanced Project Suggestions** - AI-powered candidate matching insights
- **Smart Shift Roster Generation** - AI-generated shift schedules
- **Performance Review Insights** - AI analysis of performance reviews

## Setup

### 1. Install Dependencies

The OpenAI package has been added to `server/package.json`. Install it:

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Add the following environment variables to your `.env` file in the root directory:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini  # Optional: defaults to gpt-4o-mini

# AI Tool API Key (for external tool integrations)
AI_TOOL_API_KEY=your-secure-api-key-here
```

### 3. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new secret key
5. Copy the key and add it to your `.env` file

**Important:** Keep your API key secure and never commit it to version control.

## API Endpoints

### Chat Endpoints

#### Streaming Chat (Primary)
```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "How do I request leave?" }
  ]
}
```

Response: Server-Sent Events (SSE) stream with chat completions.

#### Simple Chat (Fallback)
```http
POST /api/ai/chat/simple
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "How do I request leave?" }
  ]
}
```

Response:
```json
{
  "message": "To request leave, you need to..."
}
```

### Enhanced Project Suggestions

```http
POST /api/ai/projects/:projectId/suggestions-enhanced
Authorization: Bearer <token>
Content-Type: application/json

{
  "includeOverloaded": false
}
```

Response:
```json
{
  "candidates": [...],
  "ai_insights": "Top 3 recommended candidates...",
  "generated_at": "2024-01-01T00:00:00Z"
}
```

### Enhanced Roster Generation

```http
POST /api/ai/roster/generate-enhanced
Authorization: Bearer <token>
Content-Type: application/json

{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "roles_needed": ["developer", "designer"],
  "max_hours_per_employee": 40,
  "unavailable_employee_ids": []
}
```

Response:
```json
{
  "draft": {
    "shifts": [...],
    "summary": {
      "total_shifts": 100,
      "hours_distributed": 800,
      "notes": "Generated using OpenAI"
    }
  },
  "notes": "Generated using OpenAI"
}
```

## Frontend Integration

The frontend is already configured to use the AI chat endpoint. The `AIAssistant` component (`src/components/AIAssistant.tsx`) connects to `/api/ai/chat` and handles streaming responses.

### Usage in Frontend

The AI Assistant is available:
1. As a floating button on all pages
2. On the dedicated AI Assistant page (`/ai-assistant`)

### Example Frontend Usage

```typescript
const response = await fetch(`${API_URL}/api/ai/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Your question here' }
    ]
  })
});

// Handle streaming response
const reader = response.body.getReader();
// ... stream processing code
```

## Services

### OpenAI Service (`server/services/openai.js`)

The service provides the following functions:

#### `streamChatCompletion(messages, options)`
Streams chat completions from OpenAI.

**Parameters:**
- `messages`: Array of message objects
- `options.model`: OpenAI model (default: gpt-4o-mini)
- `options.systemMessage`: System prompt
- `options.temperature`: Temperature setting (default: 0.7)
- `options.max_tokens`: Max tokens (default: 1000)

**Returns:** OpenAI stream object

#### `getChatCompletion(messages, options)`
Gets a non-streaming chat completion.

**Parameters:** Same as `streamChatCompletion`

**Returns:** Promise<string> - Chat response text

#### `generateProjectSuggestions(project, candidates, options)`
Generates AI-powered insights for project candidate suggestions.

**Parameters:**
- `project`: Project object
- `candidates`: Array of candidate objects
- `options`: Additional options

**Returns:** Promise<string> - AI-generated suggestions text

#### `generatePerformanceInsights(review, employeeData, options)`
Generates AI analysis of performance reviews.

**Parameters:**
- `review`: Performance review object
- `employeeData`: Employee data object
- `options`: Additional options

**Returns:** Promise<string> - AI-generated insights

#### `generateShiftRoster(requirements, employees, options)`
Generates AI-powered shift rosters.

**Parameters:**
- `requirements`: Shift requirements object
- `employees`: Array of employee objects
- `options`: Additional options

**Returns:** Promise<Object> - Roster data with shifts array

## Error Handling

The integration includes comprehensive error handling:

1. **Missing API Key**: Returns 500 error if `OPENAI_API_KEY` is not configured
2. **API Errors**: Catches and logs OpenAI API errors
3. **Streaming Errors**: Handles stream interruptions gracefully
4. **Fallback Options**: Non-streaming endpoint available if streaming fails

## Rate Limiting

Rate limiting is implemented for:
- External API key requests (via `requireApiKey` middleware)
- Chat endpoints use authentication tokens (user-based limiting can be added)

## Cost Considerations

OpenAI API usage is billed per token. To manage costs:

1. **Monitor Usage**: Check OpenAI dashboard for usage statistics
2. **Set Budget Limits**: Configure spending limits in OpenAI dashboard
3. **Optimize Prompts**: Use concise system prompts
4. **Model Selection**: Use `gpt-4o-mini` for cost-effective responses
5. **Caching**: Consider implementing response caching for common queries

## Security Best Practices

1. **Never Expose API Keys**: Keep keys in environment variables only
2. **Use HTTPS**: Always use HTTPS in production
3. **Authentication**: All AI endpoints require authentication tokens
4. **Input Validation**: Validate all user inputs before sending to OpenAI
5. **Rate Limiting**: Implement rate limiting to prevent abuse

## Testing

To test the integration:

1. **Start the server**:
   ```bash
   cd server
   npm run dev
   ```

2. **Test Chat Endpoint**:
   ```bash
   curl -X POST http://localhost:3001/api/ai/chat/simple \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"messages":[{"role":"user","content":"Hello"}]}'
   ```

3. **Test in Frontend**: Navigate to `/ai-assistant` and try asking questions

## Troubleshooting

### Error: "OPENAI_API_KEY is not configured"
- **Solution**: Add `OPENAI_API_KEY` to your `.env` file

### Error: "OpenAI API error: 401"
- **Solution**: Check that your API key is valid and has not expired

### Error: "Rate limit exceeded"
- **Solution**: Wait before retrying or check your OpenAI account limits

### Streaming Not Working
- **Solution**: Use the `/api/ai/chat/simple` endpoint as fallback
- Check browser console for errors
- Verify CORS headers are set correctly

## Future Enhancements

Potential enhancements:
1. **Function Calling**: Integrate OpenAI function calling for HR system actions
2. **Vector Embeddings**: Use embeddings for semantic search
3. **Fine-tuning**: Fine-tune models on HR-specific data
4. **Response Caching**: Cache common queries to reduce costs
5. **Multi-language Support**: Add language-specific responses
6. **Context Awareness**: Include more system context in prompts

## Support

For issues or questions:
1. Check OpenAI API documentation: https://platform.openai.com/docs
2. Review server logs for detailed error messages
3. Check environment variable configuration

---

**Last Updated:** 2024  
**Version:** 1.0








