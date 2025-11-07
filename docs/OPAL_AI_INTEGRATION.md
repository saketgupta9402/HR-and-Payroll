# Opal AI Integration - Complete Guide

## Overview

Your HR system now has full **Opal integration** with OpenAI, enabling:
- **Natural Language Commands** - Talk to your HR system in plain English
- **Function Calling** - AI can execute real HR actions
- **System Training** - AI knows your HR system inside and out
- **Role-Based Context** - AI understands user permissions and capabilities

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables
Add to your `.env` file:
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
AI_TOOL_API_KEY=your-secure-api-key-for-opal
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Test Opal Integration
```bash
# Get Opal discovery manifest
curl -X GET http://localhost:3001/discovery \
  -H "x-api-key: your-api-key"

# Get OpenAPI spec
curl -X GET http://localhost:3001/api/ai/openapi.json \
  -H "x-api-key: your-api-key"
```

## 📋 Opal Discovery Endpoint

### Discovery Manifest
```
GET /discovery
Headers:
  x-api-key: your-api-key
```

Returns Opal-compatible discovery manifest:
```json
{
  "schema_version": "1.0",
  "name_for_human": "Petal HR Tools",
  "name_for_model": "petal_hr_tools",
  "description_for_human": "Roster generation, CSV diagnostics, and HR policy explanations.",
  "description_for_model": "Use these tools to generate shift rosters, validate CSV mappings, and explain HR policy thresholds.",
  "api": {
    "type": "openapi",
    "url": "http://localhost:3001/api/ai/openapi.json"
  },
  "auth": {
    "type": "api_key",
    "name": "x-api-key"
  }
}
```

### OpenAPI Specification
```
GET /api/ai/openapi.json
Headers:
  x-api-key: your-api-key
```

Returns full OpenAPI 3.1.0 specification with all available tools and functions.

## 🤖 Function Calling

The AI assistant now has access to real HR system functions:

### Available Functions

1. **`get_employee_info`** - Get employee details
   - Parameters: `employee_id` (string)

2. **`list_employees`** - List employees with filters
   - Parameters: `department`, `status`, `search`, `limit`

3. **`get_leave_request`** - Get leave request details
   - Parameters: `leave_request_id` (string)

4. **`list_pending_leave_requests`** - List pending approvals
   - Parameters: None

5. **`get_timesheet`** - Get timesheet details
   - Parameters: `timesheet_id` (string)

6. **`get_dashboard_stats`** - Get dashboard statistics
   - Parameters: None

7. **`get_leave_policies`** - Get leave policies
   - Parameters: None

## 💬 Natural Language Commands

Users can now interact with the system using natural language:

### Examples

**Employee Queries:**
- "Show me my leave balance"
- "How do I request leave?"
- "What's my current timesheet status?"
- "Who is my manager?"

**Manager Queries:**
- "Show me all pending leave requests"
- "List my team members"
- "What are the pending timesheets?"
- "Show me dashboard statistics"

**HR Queries:**
- "List all employees in Engineering"
- "Show me all active employees"
- "What are the leave policies?"
- "Get employee details for John Doe"

The AI will:
1. Understand the natural language query
2. Determine which function(s) to call
3. Execute the function(s) with appropriate parameters
4. Format and return the results in natural language

## 🎓 System Training

The AI is trained with comprehensive HR system knowledge:

### System Context
- Complete system overview
- Role hierarchy and permissions
- Leave management workflows
- Timesheet processes
- Performance review procedures
- Employee management
- Shift management
- Common tasks and queries

### Role-Based Context
The AI adapts based on user role:

**Employee Context:**
- Can view own data
- Can submit leave requests
- Can create timesheets
- Limited to personal information

**Manager Context:**
- All employee capabilities
- Can view team
- Can approve leave/timesheets
- Can conduct reviews

**HR Context:**
- Full system access
- Can manage employees
- Can manage policies
- Can view analytics

## 🔧 API Endpoints

### Chat Endpoint (Streaming)
```http
POST /api/ai/chat
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Show me pending leave requests" }
  ],
  "enable_functions": true
}
```

**Response:** Server-Sent Events (SSE) stream with:
- Function call notifications
- Function results
- Final AI response

### Chat Endpoint (Non-Streaming)
```http
POST /api/ai/chat/simple
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "List all employees" }
  ],
  "enable_functions": true
}
```

**Response:**
```json
{
  "message": "Here are all employees..."
}
```

## 📊 Function Execution Flow

```
User Query
    ↓
AI Analyzes Intent
    ↓
Selects Function(s)
    ↓
Executes Function(s)
    ↓
Gets Real Data
    ↓
Formats Response
    ↓
Returns to User
```

### Example Flow

**User:** "Show me pending leave requests"

1. **AI analyzes:** User wants to see pending leave requests
2. **AI calls:** `list_pending_leave_requests()`
3. **Function executes:** Queries database for pending requests
4. **AI formats:** Creates natural language summary
5. **AI responds:** "I found 3 pending leave requests..."

## 🔐 Authentication & Authorization

### Opal Discovery
- Uses API key: `x-api-key` header
- Configure `AI_TOOL_API_KEY` in environment

### Chat Endpoints
- Uses JWT token: `Authorization: Bearer <token>`
- Automatically retrieves user role and tenant
- Functions respect role-based permissions

### Function Execution
- All functions check user permissions
- Tenant isolation enforced
- Role-based access control

## 🎯 Use Cases

### 1. Employee Self-Service
- "What's my leave balance?"
- "How many days off do I have?"
- "When was my last review?"

### 2. Manager Dashboard
- "Show me team overview"
- "What approvals are pending?"
- "Who's on leave this week?"

### 3. HR Operations
- "Find all employees in Sales"
- "Show me leave requests over 10 days"
- "What are the active leave policies?"

### 4. Analytics
- "Show me dashboard stats"
- "How many pending timesheets?"
- "What's the employee count?"

## 🛠️ Customization

### Adding New Functions

1. Add function to `server/services/ai/functions.js`:
```javascript
export async function myNewFunction(args, userId, tenantId) {
  // Your logic here
  return { success: true, data: result };
}
```

2. Add to function executor:
```javascript
case 'my_new_function':
  return await myNewFunction(args, userId, tenantId);
```

3. Add to OpenAI function definitions in `server/services/openai.js`:
```javascript
{
  name: 'my_new_function',
  description: 'What your function does',
  parameters: { ... }
}
```

### Updating System Knowledge

Edit `server/services/ai/knowledge.js`:
- Update `HR_SYSTEM_CONTEXT` for general knowledge
- Update `getRoleContext()` for role-specific knowledge

## 📝 Examples

### Example 1: Natural Language Query
```
User: "Who is John Doe and what's his department?"

AI Process:
1. Calls get_employee_info("John Doe")
2. Retrieves employee data
3. Formats response: "John Doe is a Software Engineer in the Engineering department..."
```

### Example 2: Complex Query
```
User: "Show me all engineers who have pending leave requests"

AI Process:
1. Calls list_employees({ department: "Engineering" })
2. Calls list_pending_leave_requests()
3. Cross-references results
4. Formats response with filtered results
```

### Example 3: Statistics Query
```
User: "What's our dashboard overview?"

AI Process:
1. Calls get_dashboard_stats()
2. Formats response: "You have 50 active employees, 5 pending leave requests, and 12 pending timesheets..."
```

## 🔍 Troubleshooting

### Function Not Executing
- Check function name matches OpenAI definition
- Verify user has required permissions
- Check tenant isolation

### Incorrect Results
- Verify function logic in `functions.js`
- Check database queries
- Review role permissions

### Opal Discovery Not Working
- Verify `AI_TOOL_API_KEY` is set
- Check API key in request header
- Review OpenAPI spec format

## 🚀 Next Steps

1. **Add More Functions**
   - Approve/reject leave requests
   - Create timesheets
   - Generate reports

2. **Enhanced Training**
   - Add more system context
   - Customize role-specific knowledge
   - Add organization-specific policies

3. **Analytics Integration**
   - Connect to analytics endpoints
   - Add chart generation
   - Performance insights

## 📚 Documentation

- [OpenAI Integration Guide](./OPENAI_INTEGRATION.md)
- [Quick Start Guide](./OPENAI_QUICK_START.md)
- [System Workflows](./SYSTEM_WORKFLOWS.md)

---

**Last Updated:** 2024  
**Version:** 1.0








