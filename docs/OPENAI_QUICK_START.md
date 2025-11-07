# OpenAI Integration - Quick Start Guide

## Quick Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Add API Key to `.env`
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

### 3. Start the Server
```bash
cd server
npm run dev
```

### 4. Test in Browser
1. Navigate to http://localhost:3000
2. Log in to your account
3. Click the AI Assistant button (bottom right) or navigate to `/ai-assistant`
4. Ask a question like: "How do I request leave?"

## Available Features

### ✅ AI Chat Assistant
- Streaming chat interface
- HR-related queries support
- Available on all pages (floating button)
- Dedicated page at `/ai-assistant`

### ✅ Enhanced Project Suggestions
- AI-powered candidate matching insights
- Endpoint: `POST /api/ai/projects/:projectId/suggestions-enhanced`

### ✅ Smart Shift Roster Generation
- AI-generated shift schedules
- Endpoint: `POST /api/ai/roster/generate-enhanced`

### ✅ Performance Review Insights
- AI analysis of performance reviews
- Available via `generatePerformanceInsights()` service

## Testing

### Test Chat Endpoint (curl)
```bash
curl -X POST http://localhost:3001/api/ai/chat/simple \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"messages":[{"role":"user","content":"Hello! How can you help me?"}]}'
```

### Test in Frontend
1. Open browser developer tools (F12)
2. Navigate to AI Assistant page
3. Open Network tab
4. Send a message in the chat
5. Check the `/api/ai/chat` request/response

## Troubleshooting

### ❌ Error: "OPENAI_API_KEY is not configured"
**Solution:** Add `OPENAI_API_KEY` to your `.env` file

### ❌ Error: "OpenAI API error: 401"
**Solution:** Check your API key is valid and not expired

### ❌ Streaming not working
**Solution:** Use `/api/ai/chat/simple` endpoint as fallback

### ❌ CORS errors
**Solution:** Check server CORS configuration in `server/index.js`

## Next Steps

1. **Get API Key**: Sign up at [OpenAI Platform](https://platform.openai.com/)
2. **Configure**: Add API key to `.env` file
3. **Test**: Try the AI Assistant in the browser
4. **Customize**: Adjust system prompts in `server/services/openai.js`

For detailed documentation, see [OPENAI_INTEGRATION.md](./OPENAI_INTEGRATION.md)








