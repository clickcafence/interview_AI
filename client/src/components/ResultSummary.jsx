import React from 'react'

function scoreSession(session) {
  const { questions, answers } = session
  let correct = 0
  let total = questions.length
  const details = questions.map((q) => {
    const given = (answers || []).find((a) => a.id === q.id)?.answer
    if (q.type === 'mcq' || q.type === 'multiple_choice') {
      const isCorrect = Number(given) === Number(q.correctIndex)
      if (isCorrect) correct += 1
      return { id: q.id, type: 'mcq', prompt: q.prompt, given, correctIndex: q.correctIndex, choices: q.choices, isCorrect }
    }

    // code questions: placeholder — we'll show given and model answer
    return { id: q.id, type: 'code', prompt: q.prompt, given, modelAnswer: q.sampleAnswer || null }
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
          <div key={d.id} style={{ border: '1px solid #eee', padding: 8, marginBottom: 8 }}>
            <div><strong>{d.prompt}</strong></div>
            {d.type === 'mcq' && (
              <div>
                <div>Your answer: {d.given == null ? 'No answer' : d.choices[d.given]}</div>
                <div>Correct answer: {d.choices[d.correctIndex]}</div>
                <div>Result: {d.isCorrect ? 'Correct' : 'Incorrect'}</div>
              </div>
            )}

            {(d.type === 'code' || d.type === 'coding') && (
              <div>
                <div>Your submission:</div>
                <pre style={{ background: '#f7f7f7', padding: 8 }}>{d.given || 'No submission'}</pre>
                <div>Suggested solution / feedback:</div>
                <pre style={{ background: '#f7f7f7', padding: 8 }}>{d.modelAnswer || 'No sample answer available'}</pre>
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
