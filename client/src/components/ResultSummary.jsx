import React from 'react'

function scoreSession(session) {
  const { questions, answers } = session
  let correct = 0
  let total = questions.length
  const details = questions.map((q) => {
    const given = (answers || []).find((a) => a.id === q.id)?.answer
    if (q.type === 'mcq' || q.type === 'multiple_choice' || q.type === 'multiple-choice') {
      const isCorrect = Number(given) === Number(q.correctIndex)
      if (isCorrect) correct += 1
      return { id: q.id, type: 'mcq', prompt: q.prompt || q.question, given, correctIndex: q.correctIndex, choices: q.choices || q.options, isCorrect }
    }

    // code questions: show given and model answer; attach grader feedback if present in answers
    const meta = (answers || []).find((a) => a.id === q.id) || {}
    const userSubmission = meta.answer || given
    const modelAnswer = q.sampleAnswer || q.referenceSolution || null
    // determine correctness: prefer AI grader verdict; fallback to exact-ish match
    let isCorrect = false
    if (meta.grade && meta.grade.verdict) {
      isCorrect = String(meta.grade.verdict).toLowerCase() === 'pass'
    } else if (userSubmission && modelAnswer) {
      const normalize = (s) => (s || '').toString().replace(/\s+/g, '').replace(/;+$/g, '').toLowerCase()
  try { if (normalize(userSubmission) === normalize(modelAnswer)) isCorrect = true } catch { /* ignore */ }
    }
    if (isCorrect) correct += 1
    return { id: q.id, type: 'code', prompt: q.prompt || q.question, given: userSubmission, modelAnswer, grade: meta.grade || null, isCorrect }
  })

  return { total, correct, details }
}

export default function ResultSummary({ session, onRestart }) {
  const result = scoreSession(session)

  return (
    <div style={{ padding: 20 }}>
      <h2>Results</h2>
      <p>
        Score: {result.correct} / {result.total}
      </p>

      <div>
        {result.details.map((d) => (
          <div key={d.id} style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 8, marginBottom: 8, background: 'transparent' }}>
            <div><strong>{d.prompt}</strong></div>
            {d.type === 'mcq' && (
              <div>
                <div>Your answer: {d.given == null ? 'No answer' : d.choices[d.given]}</div>
                <div>Correct answer: {d.choices[d.correctIndex]}</div>
                <div>Result: {d.isCorrect ? 'Correct' : 'Incorrect'}</div>
              </div>
            )}

            {d.type === 'code' && (
              <div>
                <div>Your submission:</div>
                <pre style={{ background: 'var(--muted-surface)', padding: 8, color: 'var(--text)' }}>{d.given || 'No submission'}</pre>
                <div>Suggested solution / feedback:</div>
                <pre style={{ background: 'var(--muted-surface)', padding: 8, color: 'var(--text)' }}>{d.modelAnswer || 'No sample answer available'}</pre>
                <div style={{ marginTop: 8 }}>
                  <strong>Result:</strong> {d.isCorrect ? 'Correct' : 'Incorrect'}
                </div>
                {d.grade && (
                  <div style={{ marginTop: 8 }}>
                    <div><strong>Grader verdict:</strong> {d.grade.verdict}</div>
                    <div><strong>Score:</strong> {d.grade.score}</div>
                    <div><strong>Feedback:</strong> {d.grade.feedback}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <button onClick={onRestart}>Done</button>
      </div>
    </div>
  )
}
