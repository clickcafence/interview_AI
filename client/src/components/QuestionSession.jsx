import React, { useState, useEffect, useRef, useCallback } from 'react'

function MCQ({ q, value, onChange }) {
  const prompt = q.prompt || q.question || ''
  const choices = q.choices || q.options || []
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 8, marginBottom: 8, background: 'var(--surface)', color: 'var(--text)', borderRadius: 6 }}>
      <div><strong>{prompt}</strong></div>
      {choices.map((c, i) => (
        <label key={i} style={{ display: 'block' }}>
          <input
            type="radio"
            name={String(q.id)}
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
  const prompt = q.prompt || q.question || ''
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault()
    }
  }
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 8, marginBottom: 8, background: 'var(--surface)', color: 'var(--text)', borderRadius: 6 }}>
      <div><strong>{prompt}</strong></div>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        onPaste={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        spellCheck={false}
        autoComplete="off"
        aria-label="Coding answer (pasting disabled)"
        style={{ width: '100%', fontFamily: 'monospace', background: 'var(--muted-surface)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.04)', padding: 8, borderRadius: 4 }}
      />
    </div>
  )
}

export default function QuestionSession({ session = { questions: [] }, onFinish, onCancel }) {
  const { questions = [] } = session
  const [answers, setAnswers] = useState({})
  const [remaining, setRemaining] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const submittedRef = useRef(false)
  const timerRef = useRef(null)
  const submitRef = useRef(null)

  function getDurationMinutes(n) {
    if (n <= 5) return 20
    if (n <= 10) return 30
    if (n <= 16) return 40
    return 60
  }

  function formatSeconds(s) {
    if (s <= 0) return '00:00'
    const hrs = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    if (hrs > 0) return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  function setAnswer(qId, value) { setAnswers((s) => ({ ...s, [qId]: value })) }

  const submit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const arr = (questions || []).map((q) => ({ id: q.id, answer: answers[q.id] ?? null }))
    if (typeof onFinish === 'function') {
      try {
        const maybe = onFinish(arr)
        if (maybe && typeof maybe.then === 'function') {
          setSubmitting(true)
          maybe.finally(() => setSubmitting(false))
        }
      } catch (e) { console.warn('QuestionSession: onFinish callback threw', e) }
    } else {
      console.warn('QuestionSession: onFinish callback is not provided')
    }
  }, [answers, onFinish, questions])

  useEffect(() => { submitRef.current = submit }, [submit])

  useEffect(() => {
    const n = Array.isArray(questions) ? questions.length : 0
    const minutes = getDurationMinutes(n)
    const totalSec = minutes * 60
    setRemaining(totalSec)
    submittedRef.current = false

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
          try { window.alert('Time is up — submitting your answers now.') } catch { /* ignore */ }
          try { submitRef.current && submitRef.current() } catch (e) { console.error('submit from timer failed', e) }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [questions])

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

  return (
    <div style={{ padding: 20 }}>
      <h2>Interview Session</h2>
      <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
        Scoring: MCQs = 1 point each; Coding tasks = 5 points each.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: 'var(--muted)' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</div>
        <div style={{ fontWeight: 700, color: remaining <= 60 ? 'var(--danger)' : 'var(--text)', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 8 }}>
          Time remaining: {formatSeconds(remaining)}
        </div>
      </div>

      <div>
        {questions.map((q, idx) => (
          <div key={q.id ?? idx}>
            {(q.type === 'mcq' || q.type === 'multiple_choice' || q.type === 'multiple-choice') && (
              <MCQ q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            )}

            {(q.type === 'code' || q.type === 'coding') && (
              <CodeQuestion q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            )}

            {(!q.type || (['mcq','multiple_choice','multiple-choice','code','coding'].indexOf(q.type) === -1)) && (q.prompt || q.question) && (
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 8, marginBottom: 8, background: 'var(--surface)', color: 'var(--text)' }}>
                <div><strong>{q.prompt || q.question}</strong></div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={onCancel} style={{ marginRight: 8 }} disabled={submitting}>Cancel</button>
        <button onClick={submit} disabled={submitting}>
          {submitting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="spinner" style={{ width: 14, height: 14 }}></span>Submitting...</span> : 'Finish & Get Results'}
        </button>
      </div>
    </div>
  )
}
 
