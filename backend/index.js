#!/usr/bin/env node
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';

// Load env from project .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const OPENAI_KEY = process.env.BACKEND_OPENAI_KEY;
const DEFAULT_MODEL = process.env.BACKEND_OPENAI_MODEL || 'gpt-4';

if (!OPENAI_KEY) console.warn('Warning: BACKEND_OPENAI_KEY is not set. The proxy will return 500 for AI requests until you set it.');

app.use(bodyParser.json({ limit: '1mb' }));
app.use(cors());

app.get('/', (req, res) => res.json({ ok: true, message: 'Interview AI proxy running' }));

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { language = 'javascript', topic = 'algorithms', count = 10, difficulty = 'medium', role = undefined, framework = undefined } = req.body || {};
    console.log('Incoming generate-questions request body:', JSON.stringify(req.body));

    if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured on server' });

    const system = `You are an assistant that generates programming interview questions and coding tasks tailored to a requested language, role, and framework. ALWAYS respond with valid JSON only (no commentary, no explanation). The top-level JSON must be: { "questions": [ ... ] }.`;

    const fewShotExamples = `\n\nEXAMPLES (JSON only):\n` +
      `{"questions":[{"id":"q1","type":"multiple_choice","question":"Example MCQ","options":["a","b","c","d"],"correctIndex":0},{"id":"q2","type":"coding","prompt":"Example coding task","referenceSolution":"// example"}]}`;

    const nextJsExample = `\n4) Next.js example:\n` +
      `{"questions":[{"id":"q1","type":"multiple_choice","question":"Which function can be used to fetch data on each request in Next.js pages (pre-App Router)?","options":["getServerSideProps","getStaticProps","getInitialProps","useEffect"],"correctIndex":0},{"id":"q2","type":"coding","prompt":"Create a simple Next.js API route that returns JSON { message: 'hello' } when GET /api/hello is called.","referenceSolution":"export default function handler(req, res) { res.status(200).json({ message: 'hello' }) }"}]}`;

    const userPrompt = `Generate exactly ${count} interview questions focused on the language '${language}'${role ? `, role: '${role}'` : ''}${framework ? `, framework: '${framework}'` : ''}${topic ? `, topic: '${topic}'` : ''}.\n\n` +
      `STRONG REQUIREMENTS:\n- Produce JSON only, with top-level { \"questions\": [...] } and nothing else.\n- Mix multiple-choice (type: \"multiple_choice\") and coding tasks (type: \"coding\").\n` +
      `EXAMPLES:` + fewShotExamples + nextJsExample;

    const requiredCoding = Math.max(1, Math.ceil(count * 0.25));
    const extraFrameworkPrompt = framework ? `\n\nADDITIONAL FRAMEWORK RULES: If framework='${framework}', ensure at least ${requiredCoding} of the ${count} questions are coding/practical tasks directly targeting ${framework}.` : '';

    const body = {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt + extraFrameworkPrompt },
      ],
      temperature: 0.0,
      max_tokens: 1500,
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: 'OpenAI error', detail: txt });
    }

    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;

    let parsed = null;
    try { parsed = JSON.parse(content); } catch (e) { parsed = null }

    if (parsed && parsed.questions) return res.json({ ok: true, data: parsed, assistant: content });
    return res.json({ ok: true, data: { raw: content }, assistant: content });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/grade-code', async (req, res) => {
  try {
    const { question, userCode } = req.body || {};
    if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured on server' });
    if (!question) return res.status(400).json({ error: 'question is required' });

    const prompt = `You are an expert programming interviewer. Grade the student's submission.\n---\nQuestion prompt:\n${question.prompt}\n---\nReference solution:\n${question.referenceSolution}\n---\nStudent submission:\n${userCode}\n---\nProvide a JSON response only with shape: {\n  \"score\": number (0-100),\n  \"verdict\": \"pass\"|\"partial\"|\"fail\",\n  \"feedback\": string\n}`;

    const body = {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful, concise code reviewer and grader.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 800,
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: 'OpenAI error', detail: txt });
    }

    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
    try { const parsed = JSON.parse(content); return res.json({ ok: true, data: parsed }) } catch (e) { return res.json({ ok: true, data: { raw: content } }) }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Backend AI proxy listening on http://localhost:${PORT}`));
