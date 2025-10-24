#!/usr/bin/env node
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const OPENAI_KEY = process.env.BACKEND_OPENAI_KEY;
const DEFAULT_MODEL = process.env.BACKEND_OPENAI_MODEL || 'gpt-4';

if (!OPENAI_KEY) {
  console.warn('Warning: BACKEND_OPENAI_KEY is not set. The proxy will return 500 for AI requests until you set it.');
}

app.use(bodyParser.json({ limit: '1mb' }));

// Allow CORS from the client dev server (vite) or other origins in development
import cors from 'cors';
app.use(cors());

app.get('/', (req, res) => res.json({ ok: true, message: 'Interview AI proxy running' }));

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { language = 'javascript', topic = 'algorithms', count = 10, difficulty = 'medium', role = undefined, framework = undefined } = req.body || {};
    console.log('Incoming generate-questions request body:', JSON.stringify(req.body))

    if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured on server' });

    // Stronger prompt: include role/framework, explicit example schema, and few-shot examples for Database/HTML/DevOps.
    const system = `You are an assistant that generates programming interview questions and coding tasks tailored to a requested language, role, and framework. ALWAYS respond with valid JSON only (no commentary, no explanation). The top-level JSON must be: { "questions": [ ... ] }.`;

  const fewShotExamples = `\n\nEXAMPLES (JSON only):\n` +
  `1) Database (SQL) example A:\n` +
  `{\"questions\":[{\"id\":\"q1\",\"type\":\"multiple_choice\",\"question\":\"Which SQL clause is used to filter rows based on a condition?\",\"options\":[\"WHERE\",\"GROUP BY\",\"ORDER BY\",\"HAVING\"],\"correctIndex\":0},{\"id\":\"q2\",\"type\":\"coding\",\"prompt\":\"Write an SQL query that selects the name and email from users where active=1\",\"referenceSolution\":\"SELECT name, email FROM users WHERE active = 1;\"}]}\n\n` +
  `1b) Database (SQL) example B:\n` +
  `{\"questions\":[{\"id\":\"q1\",\"type\":\"multiple_choice\",\"question\":\"Which index type is most appropriate for range queries on a numeric column?\",\"options\":[\"B-tree index\",\"Hash index\",\"GiST index\",\"GIN index\"],\"correctIndex\":0},{\"id\":\"q2\",\"type\":\"coding\",\"prompt\":\"Write an SQL statement to create a table 'orders' with id (primary key), user_id (int), total (decimal)\",\"referenceSolution\":\"CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INTEGER, total DECIMAL(10,2));\"}]}\n\n` +
      `2) HTML/Frontend example:\n` +
      `{\"questions\":[{\"id\":\"q1\",\"type\":\"multiple_choice\",\"question\":\"What does the HTML <main> element represent?\",\"options\":[\"The main content of a document\",\"A navigation region\",\"A footer\",\"A sidebar\"],\"correctIndex\":0},{\"id\":\"q2\",\"type\":\"coding\",\"prompt\":\"Create an accessible HTML form with a labeled input for email\",\"referenceSolution\":\"<form><label for=\\\"email\\\">Email</label><input id=\\\"email\\\" type=\\\"email\\\" /></form>\"}]}\n\n` +
      `3) DevOps example:\n` +
      `{\"questions\":[{\"id\":\"q1\",\"type\":\"multiple_choice\",\"question\":\"Which file is commonly used to define a Docker image build process?\",\"options\":[\"Dockerfile\",\"docker-compose.yml\",\"Jenkinsfile\",\".env\"],\"correctIndex\":0},{\"id\":\"q2\",\"type\":\"coding\",\"prompt\":\"Write a minimal Dockerfile for a Node.js app using 'node:18' base image\",\"referenceSolution\":\"FROM node:18\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nCMD [\"node\", \"index.js\"]\"}]}\n\n`;

    // We'll ask the model to produce 2x the requested count initially and dedupe on the server
    const userPrompt = `Generate exactly ${count} interview questions focused on the language '${language}'${role ? `, role: '${role}'` : ''}${framework ? `, framework: '${framework}'` : ''}${topic ? `, topic: '${topic}'` : ''}.\n\n` +
      `STRONG REQUIREMENTS:\n` +
      `- Produce JSON only, with top-level { "questions": [...] } and nothing else. Do NOT include any explanation or extra text.\n` +
      `- Questions MUST be relevant to the requested language and role. If language is 'html' or role is 'database', DO NOT include code snippets or questions about unrelated languages (for example: JavaScript, Python, Java) — use SQL for database tasks.\n` +
      `- Mix multiple-choice (type: \"multiple_choice\") and coding/markup/SQL tasks (type: \"coding\").\n` +
      `- For multiple-choice, include: { \"type\": \"multiple_choice\", \"question\": string, \"options\": [strings], \"correctIndex\": number }\n` +
      `- For coding tasks, include: { \"type\": \"coding\", \"prompt\": string, \"referenceSolution\": string }\n\n` +
      `EXAMPLES FOLLOW (use these as templates):` + fewShotExamples + `Now produce the JSON with ${count} questions and nothing else.`;

    // Use sampling parameters to increase diversity, and generate 2x items so we can dedupe server-side.
    // We still perform a deterministic corrective retry (temperature: 0.0) if validation fails.
    const generationCount = Math.min(Math.max(count * 2, count), 50) // cap at 50 to avoid huge responses
    const genPrompt = userPrompt.replace(`Generate exactly ${count}`, `Generate exactly ${generationCount}`)

    const body = {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: genPrompt + '\n\nDIVERSITY_INSTRUCTION: Produce a varied set of questions; avoid repeating the same template more than twice. Vary the cognitive level (knowledge, application, analysis). Include a small \"topic\" field for each question (e.g. \"arrays\", \"strings\", \"closures\"). Do not sacrifice the JSON-only requirement.' },
      ],
      temperature: 0.6,
      top_p: 0.95,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      max_tokens: 2000,
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
  console.log('OpenAI assistant content (truncated):', typeof content === 'string' ? content.slice(0, 1000).replace(/\n/g, ' ') : content)

    // try to parse JSON, fallback to returning raw content
    let parsed = null
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      // attempt to extract JSON substring
      const first = content ? content.indexOf('{') : -1
      const last = content ? content.lastIndexOf('}') : -1
      if (first !== -1 && last !== -1) {
        try {
          parsed = JSON.parse(content.slice(first, last + 1))
        } catch (e) {
          parsed = null
        }
      }
    }

    // Helper: normalize text for deduping
    function normalizeText(s) {
      if (!s) return ''
      return s
        .toString()
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[\\/\-_.:,;()\[\]{}"'`<>]/g, ' ')
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // simple similarity: Jaccard over word tokens
    function similarity(a, b) {
      const as = normalizeText(a).split(' ').filter(Boolean)
      const bs = normalizeText(b).split(' ').filter(Boolean)
      if (as.length === 0 || bs.length === 0) return 0
      const aset = new Set(as)
      const bset = new Set(bs)
      let inter = 0
      for (const w of aset) if (bset.has(w)) inter++
      const uni = new Set([...aset, ...bset]).size
      return uni === 0 ? 0 : inter / uni
    }

    function dedupeQuestions(arr, needed) {
      const kept = []
      for (const q of arr) {
        const prompt = (q.question || q.prompt || q.referenceSolution || '').toString()
        const n = normalizeText(prompt)
        let isDup = false
        for (const k of kept) {
          const kp = (k.question || k.prompt || k.referenceSolution || '').toString()
          if (similarity(n, kp) > 0.7) {
            isDup = true
            break
          }
        }
        if (!isDup) kept.push(q)
        if (kept.length >= needed) break
      }
      return kept
    }

    // If parsed contains questions and is an array, we'll attempt to dedupe and, if needed, run a second generation and merge.
    async function generateAndDedupe(attempts = 2) {
      let collected = []
      let lastContent = content
      if (parsed && parsed.questions && Array.isArray(parsed.questions)) collected = collected.concat(parsed.questions)

      // if first pass didn't produce enough unique, run another generation attempt and merge
      for (let i = 1; i < attempts && collected.length < count * attempts; i++) {
        // call the API again for another batch
        const rr = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify(body),
        })
        if (!rr.ok) break
        const data2 = await rr.json()
        const content2 = data2.choices && data2.choices[0] && data2.choices[0].message ? data2.choices[0].message.content : null
        lastContent = content2
        try {
          const p2 = JSON.parse(content2)
          if (p2 && p2.questions && Array.isArray(p2.questions)) collected = collected.concat(p2.questions)
        } catch (e) {
          const first = content2 ? content2.indexOf('{') : -1
          const last = content2 ? content2.lastIndexOf('}') : -1
          if (first !== -1 && last !== -1) {
            try {
              const p2 = JSON.parse(content2.slice(first, last + 1))
              if (p2 && p2.questions && Array.isArray(p2.questions)) collected = collected.concat(p2.questions)
            } catch (ee) {
              // ignore
            }
          }
        }
      }

      // dedupe collected and return up to `count` items
      const unique = dedupeQuestions(collected, count)
      return { unique, rawContent: lastContent }
    }

    const dedupedResult = await generateAndDedupe(2)
    const uniqueQuestions = dedupedResult.unique || []
    // validate the deduped set
    if (uniqueQuestions.length > 0) {
      const validation = validateQuestionsList(uniqueQuestions, language, role)
      if (!validation.ok) {
        console.warn('Validation failed for assistant output after dedupe, attempting one corrective retry', validation.problems)
        // fall through to existing corrective retry behavior by reusing lastContent
        parsed = { questions: uniqueQuestions }
        // reuse content for corrective retry below
      } else {
        return res.json({ ok: true, data: { questions: uniqueQuestions.slice(0, count) }, assistant: dedupedResult.rawContent })
      }
    }

    // If dedupe didn't produce the requested number, but parsed had some questions, return them (best-effort)
    if ((!parsed || !parsed.questions || parsed.questions.length === 0) && parsed && parsed.questions && parsed.questions.length > 0) {
      return res.json({ ok: true, data: { questions: parsed.questions.slice(0, count) }, assistant: content })
    }

    // Validation heuristics: ensure questions are tailored to the requested language/role
    function containsForeignLanguageText(text, lang) {
      if (!text) return false
      const t = text.toLowerCase()
      // Only flag tokens that strongly indicate *other* languages. Previously the lists
      // included JavaScript tokens (function/var/let/const/console.log) which caused
      // many JS questions to be incorrectly marked as "foreign-language". Use a
      // conservative set of tokens per language that represent other-language syntax.
      const checks = {
        javascript: ['def ', 'import numpy', 'print(', 'printf(', 'public static', 'system.out', 'std::', '#include', 'cout<<'],
        python: ['console.log', "console.error", 'var ', 'let ', 'const ', '=>', 'function '],
        java: ['console.log', 'var ', 'let ', 'const ', 'console.error', '=>', 'def '],
        html: ['def ', 'print(', 'public static', 'system.out', 'std::', '#include'],
        sql: ['def ', 'console.log', 'public static', 'function ', 'var ', 'let ', 'const '],
        csharp: ['def ', 'console.log', 'print(', 'std::', 'cout<<'],
      }
      const list = checks[lang] || []
      return list.some((tok) => t.includes(tok))
    }

    function validateQuestionsList(qs, lang, role) {
      if (!Array.isArray(qs)) return { ok: false, reason: 'not an array' }
      const problems = []
      for (const q of qs) {
        const combined = (q.question || q.prompt || q.referenceSolution || '').toString()
        if (containsForeignLanguageText(combined, lang)) {
          problems.push({ id: q.id || null, reason: 'contains foreign-language tokens' })
        }
        // role-specific hint: if role is 'database', expect SQL-like tokens
        if (role === 'database') {
          const t = combined.toLowerCase()
          if (!(/select\b|insert\b|update\b|delete\b|join\b|primary key|foreign key/.test(t))) {
            // may still be fine (the question could be conceptual) - only flag if it's clearly code in another language
          }
        }
      }
      return { ok: problems.length === 0, problems }
    }

    if (parsed && parsed.questions) {
      const validation = validateQuestionsList(parsed.questions, language, role)
      if (!validation.ok) {
        console.warn('Validation failed for assistant output, attempting one corrective retry', validation.problems)
        // retry once with a corrective instruction
        const fixPrompt = `The previous response included questions that are not specific to the requested language (${language}) or role (${role}). Please produce JSON only with the same schema and make sure ALL questions are strictly about the requested language and role. Example for ${language}: ${JSON.stringify({ questions: [{ id: 'q1', type: 'multiple_choice', question: 'Example', options: ['a','b'], correctIndex: 0 }] })}`
        const fixBody = {
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: 'You are an assistant that must strictly follow user instructions and output valid JSON only.' },
            { role: 'user', content: fixPrompt },
            { role: 'assistant', content: content },
          ],
          temperature: 0.0,
          max_tokens: 1500,
        }
        const rr = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify(fixBody),
        })
        if (rr.ok) {
          const data2 = await rr.json()
          const content2 = data2.choices && data2.choices[0] && data2.choices[0].message ? data2.choices[0].message.content : null
          console.log('Assistant corrective response (truncated):', typeof content2 === 'string' ? content2.slice(0, 1000).replace(/\n/g, ' ') : content2)
          try {
            const parsed2 = JSON.parse(content2)
            // re-validate parsed2
            const validation2 = parsed2 && parsed2.questions ? validateQuestionsList(parsed2.questions, language, role) : { ok: false, reason: 'no questions' }
            if (!validation2.ok) {
              console.warn('Corrective retry still failed validation:', validation2)
              return res.status(422).json({ ok: false, error: 'ai_response_not_in_language', reason: validation2, assistant: content2, data: parsed2 })
            }
            return res.json({ ok: true, data: parsed2, assistant: content2 })
          } catch (e) {
            // fallback: return raw corrective content
            return res.status(422).json({ ok: false, error: 'ai_response_not_parseable_after_retry', assistant: content2 })
          }
        }
      }
    }

    if (parsed) return res.json({ ok: true, data: parsed, assistant: content })
    return res.json({ ok: true, data: { raw: content }, assistant: content })
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/grade-code', async (req, res) => {
  try {
    const { question, userCode } = req.body || {};
    if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured on server' });
    if (!question) return res.status(400).json({ error: 'question is required' });

    const prompt = `You are an expert programming interviewer. Grade the student's submission.\n---\nQuestion prompt:\n${question.prompt}\n---\nReference solution:\n${question.referenceSolution}\n---\nStudent submission:\n${userCode}\n---\nProvide a JSON response only with shape: {\n  "score": number (0-100),\n  "verdict": "pass"|"partial"|"fail",\n  "feedback": string\n}`;

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
    try {
      const parsed = JSON.parse(content);
      return res.json({ ok: true, data: parsed });
    } catch (err) {
      return res.json({ ok: true, data: { raw: content } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend AI proxy listening on http://localhost:${PORT}`);
});
