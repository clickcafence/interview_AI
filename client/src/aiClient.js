// aiClient.js
// Small AI client helper for the interview app.
// Supports a mock mode (local deterministic questions) and a real OpenAI ChatCompletions
// integration via fetch. For production, prefer a backend proxy that keeps the API key secret.

// Usage:
// import { generateQuestions, gradeAnswers, gradeCodingWithAI, isMock } from './aiClient'
// const qs = await generateQuestions({ language: 'javascript', topic: 'arrays', count: 10 })

const USE_MOCK = (import.meta && import.meta.env && import.meta.env.VITE_USE_MOCK_AI === 'true') || false;
const OPENAI_KEY = import.meta && import.meta.env ? import.meta.env.VITE_OPENAI_KEY : undefined;
const DEFAULT_MODEL = import.meta && import.meta.env && import.meta.env.VITE_OPENAI_MODEL ? import.meta.env.VITE_OPENAI_MODEL : 'gpt-4';
// backend proxy URL (optional). If not set, and OPENAI_KEY is available, the client will call OpenAI directly.
const BACKEND_URL = import.meta && import.meta.env && import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL : undefined;

function randId(prefix = 'q') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateMockQuestions({ language = 'javascript', topic = 'general', count = 5 } = {}) {
  const questions = [];
  for (let i = 0; i < Math.min(count, 8); i++) {
    if (i % 4 === 3) {
      // coding question every 4th
      questions.push({
        id: randId('coding'),
        type: 'coding',
        language,
        prompt: `Write a function in ${language} that reverses an array and returns a new array. Provide a simple example usage.`,
        referenceSolution: `function reverseArray(arr) { return arr.slice().reverse(); }\n// example: reverseArray([1,2,3]) // [3,2,1]`,
      });
    } else {
      const idx = i % 3;
      const question = {
        id: randId('mc'),
        type: 'multiple_choice',
        question: `(${topic}) What is the output of this ${language} expression #${i + 1}?`,
        options: [`Option A`, `Option B`, `Option C`, `Option D`],
        correctIndex: idx,
      };
      questions.push(question);
    }
  }
  return questions;
}

async function callOpenAIChat({ messages = [], model = DEFAULT_MODEL, temperature = 0.2, max_tokens = 1500 } = {}) {
  if (!OPENAI_KEY) throw new Error('OpenAI API key not provided. Set VITE_OPENAI_KEY in .env.local or use a server proxy.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Chat completion -> take first choice
  const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
  return content;
}

/**
 * generateQuestions(options)
 * options: { language, topic, count, difficulty }
 * returns: Array of question objects.
 * Question schema (MVP):
 * - id
 * - type: 'multiple_choice' | 'coding'
 * - question (for MC), options (array), correctIndex (number)
 * - prompt (for coding), referenceSolution (string)
 */
export async function generateQuestions({ language = 'javascript', topic = 'algorithms', count = 10, difficulty = 'medium', role = undefined, framework = undefined, useModel } = {}) {
  if (USE_MOCK) return generateMockQuestions({ language, topic, count });

  // If backend proxy is configured, call it
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/generate-questions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, topic, count, difficulty, role, framework }),
    });
    if (!res.ok) throw new Error(`Backend proxy error: ${res.status}`);
    const j = await res.json();
    const parsed = j && j.data && j.data.questions ? j.data : (j && j.data && j.data.raw ? { questions: [] } : (j && j.data ? j.data : j));
    const q = (parsed.questions || []).map((qq) => ({ id: randId(qq.type || 'q'), ...qq }));
    return q;
  }

  // Fallback: call OpenAI directly from client (not recommended for production)
  if (!OPENAI_KEY) throw new Error('No backend proxy and no OPENAI key available. Set VITE_BACKEND_URL or VITE_OPENAI_KEY.');

  const model = useModel || DEFAULT_MODEL;
  const system = `You are an assistant that generates programming interview questions in JSON. Respond with valid JSON only, no surrounding text. The top-level JSON must be: { "questions": [ ... ] }.`;
  const userPrompt = `Generate ${count} programming interview questions about "${topic}" in ${language}. Mix multiple-choice and coding questions. For multiple-choice include a 'question' string, 'options' array and 'correctIndex' (0-based). For coding questions include 'prompt' and a short 'referenceSolution'. Keep difficulty ${difficulty}. Output must be parseable JSON using the schema described.`;
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ];

  const text = await callOpenAIChat({ messages, model });
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1) {
      const slice = text.slice(first, last + 1);
      parsed = JSON.parse(slice);
    } else {
      throw new Error('Failed to parse JSON from AI response: ' + err.message + '\nResponse:\n' + text);
    }
  }
  const q = (parsed.questions || []).map((qq) => ({ id: randId(qq.type || 'q'), ...qq }));
  return q;
}

/**
 * gradeAnswers(questions, answers)
 * questions: array returned by generateQuestions
 * answers: map from question id -> answer (for multiple_choice: index number; for coding: user code string)
 * Returns: { total, correct, results: [{ id, correct, expected, given, score (0/1 for MC) }] }
 */
export async function gradeAnswers(questions = [], answers = {}) {
  const results = [];
  let correct = 0;

  for (const q of questions) {
    if (q.type === 'multiple_choice') {
      const given = answers[q.id];
      const expected = q.correctIndex;
      const isCorrect = Number(given) === Number(expected);
      if (isCorrect) correct++;
      results.push({ id: q.id, type: q.type, correct: isCorrect, expected, given });
    } else if (q.type === 'coding') {
      const userCode = answers[q.id];
      // For MVP, we'll set coding as ungraded (or call AI grader if configured)
      const grading = { id: q.id, type: q.type, correct: null, given: userCode, expected: q.referenceSolution };
      results.push(grading);
    } else {
      results.push({ id: q.id, type: q.type, correct: null });
    }
  }

  return { total: questions.length, correct, incorrect: questions.length - correct, results };
}

/**
 * gradeCodingWithAI(question, userCode, opts)
 * Use the AI model to grade a coding answer against the referenceSolution or test description.
 * Returns { score: 0-100, verdict: 'pass'|'partial'|'fail', feedback }
 */
export async function gradeCodingWithAI(question, userCode, { model } = {}) {
  if (USE_MOCK) {
    // simple heuristic mock grading
    const pass = userCode && userCode.length > 20;
    return { score: pass ? 90 : 30, verdict: pass ? 'pass' : 'fail', feedback: pass ? 'Solution looks reasonable (mock).' : 'Solution too short (mock).' };
  }

  if (!question || !question.referenceSolution) {
    throw new Error('Question must include a referenceSolution to allow AI grading.');
  }

  const prompt = `You are an expert programming interviewer. Grade the student's submission.\n---\nQuestion prompt:\n${question.prompt}\n---\nReference solution:\n${question.referenceSolution}\n---\nStudent submission:\n${userCode}\n---\nProvide a JSON response only with shape: {\n  "score": number (0-100),\n  "verdict": "pass"|"partial"|"fail",\n  "feedback": string\n}`;

  const messages = [
    { role: 'system', content: 'You are a helpful, concise code reviewer and grader.' },
    { role: 'user', content: prompt },
  ];

  const text = await callOpenAIChat({ messages, model: model || DEFAULT_MODEL, temperature: 0 });

  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    // best-effort extraction
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1) {
      const slice = text.slice(first, last + 1);
      return JSON.parse(slice);
    }
    throw new Error('Failed to parse AI grader response: ' + err.message + '\nResponse:\n' + text);
  }
}

export const isMock = () => USE_MOCK;

// Notes:
// - In development you can set VITE_USE_MOCK_AI=true in .env.local to avoid using the real API.
// - To use the real API from the browser (not recommended for production) set VITE_OPENAI_KEY in .env.local.
// - For production, create a small backend endpoint that holds the API key and proxies requests.
//   That endpoint can expose /api/ai/generate-questions and /api/ai/grade-code and forward requests to OpenAI.
