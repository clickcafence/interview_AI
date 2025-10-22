import React, { useState, useEffect, useRef } from 'react'

function MCQ({ q, value, onChange }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
      <div><strong>{q.prompt}</strong></div>
      {q.choices.map((c, i) => (
        <label key={i} style={{ display: 'block' }}>
          <input
            type="radio"
            name={q.id}
            value={i}
            checked={String(value) === String(i)}
            onChange={() => onChange(i)}
          />{' '}
          {c}
        </label>
      ))}
    </div>
  )
}

function CodeQuestion({ q, value, onChange }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
      <div><strong>{q.prompt}</strong></div>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        style={{ width: '100%', fontFamily: 'monospace' }}
      />
    </div>
  )
}

export default function QuestionSession({ session, onFinish, onCancel }) {
  const { questions } = session
  const [answers, setAnswers] = useState({})
  const [remaining, setRemaining] = useState(0)
  const submittedRef = useRef(false)
  const timerRef = useRef(null)

  // Determine duration (minutes) based on number of questions
  function getDurationMinutes(n) {
    // Assumption: ranges are inclusive and cascade as follows:
    // <=5 => 20 minutes, 6-10 => 30 minutes, 11-16 => 40 minutes, >16 => 60 minutes
    if (n <= 5) return 20
    if (n <= 10) return 30
    if (n <= 16) return 40
    return 60
  }

  // Format seconds to MM:SS or H:MM:SS when >= 3600
  function formatSeconds(s) {
    if (s <= 0) return '00:00'
    const hrs = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Initialize / reset timer when question count changes
  useEffect(() => {
    const n = Array.isArray(questions) ? questions.length : 0
    const minutes = getDurationMinutes(n)
    const totalSec = minutes * 60
    setRemaining(totalSec)
    submittedRef.current = false

    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Start countdown
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          // show alert and auto-submit when time expires
          try {
            // Inform the user (blocks until dismissed)
            window.alert('Time is up — submitting your answers now.')
          } catch {
            // If alerts are unavailable, continue silently
          }
          // Call submit() which sets the submitted flag; do not set it here (would short-circuit submit)
          submit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions && questions.length])

  if (!questions || questions.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Interview Session</h2>
        <div>No questions were provided for this session.</div>
        <div style={{ marginTop: 12 }}>
          <button onClick={onCancel}>Back</button>
        </div>
      </div>
    )
  }

  function setAnswer(qId, value) {
    setAnswers((s) => ({ ...s, [qId]: value }))
  }

  function submit() {
    if (submittedRef.current) return
    submittedRef.current = true
    // Build array of answers matching questions order
    const arr = questions.map((q) => ({ id: q.id, answer: answers[q.id] ?? null }))
    onFinish(arr)
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Interview Session</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: 'var(--muted)' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</div>
        <div style={{ fontWeight: 700, color: remaining <= 60 ? 'var(--danger)' : 'var(--text)', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 8 }}>
          Time remaining: {formatSeconds(remaining)}
        </div>
      </div>

      <div>
        {questions.map((q) => (
          <div key={q.id}>
            {(q.type === 'mcq' || q.type === 'multiple_choice') && (
              <MCQ q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            )}

            {(q.type === 'code' || q.type === 'coding') && (
              <CodeQuestion q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={onCancel} style={{ marginRight: 8 }}>Cancel</button>
        <button onClick={submit}>Finish & Get Results</button>
      </div>
    </div>
  )
}
