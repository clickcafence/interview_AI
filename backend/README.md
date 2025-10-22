# Backend AI Proxy

This is a minimal Express proxy that forwards question-generation and code-grading requests to the OpenAI Chat Completions API. It keeps the OpenAI API key on the server (recommended) instead of exposing it to the client.

Environment variables
- `BACKEND_OPENAI_KEY` - your OpenAI API key (required)
- `BACKEND_OPENAI_MODEL` - model to use (default: `gpt-4`)
- `PORT` - port to listen on (default: `4000`)

Endpoints
- `POST /api/generate-questions` - body: { language, topic, count, difficulty }
  - returns: { ok: true, data: parsedJsonOrRaw }
- `POST /api/grade-code` - body: { question, userCode }
  - returns: { ok: true, data: parsedJsonOrRaw }

Run locally
1. Copy `.env.example` to `.env` and fill `BACKEND_OPENAI_KEY`.
2. Install dependencies: `npm install`
3. Start server: `npm start`
