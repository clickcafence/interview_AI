// aiClient.js
// Lightweight mock of an AI question generator. Replace generateQuestions
// implementation with a call to an AI API (OpenAI or other) when ready.

let idCounter = 1

function nextId() {
  return `q_${idCounter++}`
}

const USE_MOCK = import.meta && import.meta.env && import.meta.env.VITE_USE_MOCK_AI === 'true'
const BACKEND_URL = import.meta && import.meta.env && import.meta.env.VITE_BACKEND_URL

function normalizeQuestion(raw) {
  // Strict normalization: only accept complete items, otherwise return null
  const type = (raw.type || raw.questionType || raw.qtype || '').toString().toLowerCase()
  const isMcq = type.includes('multiple') || type.includes('mcq') || !!raw.options || !!raw.choices
  if (isMcq) {
    const prompt = raw.question || raw.prompt
    const choices = raw.options || raw.choices
    const ci = raw.correctIndex
    if (!prompt || !Array.isArray(choices) || choices.length < 2 || !Number.isInteger(ci) || ci < 0 || ci >= choices.length) return null
    return {
      id: raw.id || nextId(),
      type: 'mcq',
      prompt,
      choices,
      correctIndex: ci,
    }
  }

  // coding / code
  const isCode = type === 'code' || type === 'coding' || (!!raw.prompt && !isMcq)
  if (isCode) {
    const prompt = raw.prompt || raw.question
    const sample = raw.referenceSolution || raw.sampleAnswer || raw.answer
    if (!prompt || !sample) return null
    return {
      id: raw.id || nextId(),
      type: 'code',
      prompt,
      sampleAnswer: sample,
    }
  }
  return null
}

export async function generateQuestions({ language = 'javascript', numQuestions = 5, role = undefined, framework = undefined } = {}) {
  if (USE_MOCK) {
    // reuse old mock behavior
    const mcqCount = Math.max(0, numQuestions - 1)
    const questions = []
    for (let i = 0; i < mcqCount; i++) {
      questions.push({
        id: nextId(),
        type: 'mcq',
        prompt: `What is the output of the following ${language} snippet? (example ${i + 1})`,
        choices: ['A', 'B', 'C', 'D'].map((c, idx) => `${c}: sample option ${idx + 1}`),
        correctIndex: Math.floor(Math.random() * 4),
      })
    }
    questions.push({
      id: nextId(),
      type: 'code',
      prompt: `Write a ${language} function that returns the sum of an array of numbers.`,
      sampleAnswer:
        language === 'python'
          ? 'def sum_array(arr):\n    return sum(arr)'
          : language === 'java'
          ? '// Java example\npublic int sumArray(int[] arr) { int s = 0; for(int v: arr) s += v; return s; }'
          : '// JavaScript example\nfunction sumArray(arr) { return arr.reduce((a,b) => a+b, 0); }',
    })
    await new Promise((r) => setTimeout(r, 300))
    return questions
  }

  // If backend proxy is configured, call it
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/generate-questions`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, count: numQuestions, role, framework }),
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Backend proxy error ${res.status}: ${txt}`)
    }
  const j = await res.json()
  const data = j && j.data ? j.data : j
  const assistant = j && j.assistant ? j.assistant : null
  let raws = []
    if (data.questions && Array.isArray(data.questions)) {
      raws = data.questions
    } else if (Array.isArray(data)) {
      raws = data
    } else if (data.raw && typeof data.raw === 'string') {
      // try to parse embedded JSON from AI raw text
      try {
        const first = data.raw.indexOf('{')
        const last = data.raw.lastIndexOf('}')
        if (first !== -1 && last !== -1) {
          const slice = data.raw.slice(first, last + 1)
          const parsed = JSON.parse(slice)
          if (parsed && Array.isArray(parsed.questions)) raws = parsed.questions
        }
      } catch {
        // ignore
      }
    }

    // Fallback: try to parse the assistant content if still empty
    if ((!raws || raws.length === 0) && typeof assistant === 'string') {
      try {
        // Try direct parse
        const parsedA = JSON.parse(assistant)
        if (parsedA && Array.isArray(parsedA.questions)) raws = parsedA.questions
      } catch {
        // Try extracting JSON substring from assistant
        try {
          const first = assistant.indexOf('{')
          const last = assistant.lastIndexOf('}')
          if (first !== -1 && last !== -1) {
            const slice = assistant.slice(first, last + 1)
            const parsed = JSON.parse(slice)
            if (parsed && Array.isArray(parsed.questions)) raws = parsed.questions
          }
        } catch {
          // ignore
        }
      }
    }

  const questions = (raws || []).map((r) => normalizeQuestion(r, language)).filter(Boolean)
    return { questions, assistant }
  }

  // No backend and not mock: throw (we don't call OpenAI directly from this module in this variant)
  throw new Error('No backend proxy configured and mock mode disabled. Set VITE_BACKEND_URL or VITE_USE_MOCK_AI=true')
}

/**
 * gradeCoding(question, userCode)
 * Prefer calling the backend proxy if configured; otherwise fall back to a simple heuristic.
 */
export async function gradeCoding(question, userCode) {
  if (BACKEND_URL) {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/api/grade-code`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, userCode }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Backend grade-code error ${res.status}: ${txt}`);
    }
    const j = await res.json();
    if (j && j.data) return j.data;
    return j;
  }

  // simple heuristic fallback
  const pass = userCode && userCode.length > 20;
  return { score: pass ? 90 : 30, verdict: pass ? 'pass' : 'fail', feedback: pass ? 'Solution looks reasonable (heuristic).' : 'Solution too short (heuristic).' };
}
