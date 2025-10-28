import { useState } from 'react'
import './App.css'
import Home from './components/Home'
import CreateInterview from './components/CreateInterview'
import QuestionSession from './components/QuestionSession'
import ResultSummary from './components/ResultSummary'
import { generateQuestions, gradeCoding } from './lib/aiClient'

function App() {
  const [screen, setScreen] = useState('home') // home | create | session | result
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(config) {
    setError(null)
    setLoading(true)
    try {
      // Generate questions (mock or real depending on config)
      const result = await generateQuestions(config)
      setLoading(false)
      console.log('Generated questions result:', result)
      const questions = Array.isArray(result) ? result : result.questions
      const assistant = result && result.assistant ? result.assistant : null
      if (!questions || questions.length === 0) {
        setError('No questions were generated. Check backend logs or the network response.')
        return
      }
      setSession({ config, questions, answers: [], assistant })
      setScreen('session')
    } catch (err) {
      console.error('Error generating questions', err)
      setLoading(false)
      setError(err.message || String(err))
    }
  }

  async function handleFinish(answers) {
    // For coding answers, call AI grader and attach feedback before showing results
    try {
      const s = session
      const questions = s?.questions || []
      const updatedAnswers = Array.isArray(answers) ? [...answers] : []
      // find coding questions and grade them
      for (const q of questions) {
        if (q.type === 'coding' || q.type === 'code') {
          const userCode = (answers || []).find((a) => a.id === q.id)?.answer
          if (userCode) {
            try {
              const grade = await gradeCoding(q, userCode)
              // attach grade into answers list as metadata
              const idx = updatedAnswers.findIndex((a) => a.id === q.id)
              if (idx !== -1) updatedAnswers[idx] = { ...updatedAnswers[idx], grade }
            } catch (e) {
              console.warn('grading failed for question', q.id, e)
            }
          }
        }
      }
      setSession((s) => ({ ...s, answers: updatedAnswers }))
      setScreen('result')
    } catch (e) {
      console.error('Error while grading coding answers', e)
      setSession((s) => ({ ...s, answers }))
      setScreen('result')
    }
  }

  function handleRestart() {
    setSession(null)
    setScreen('home')
  }

  return (
    <div className="app-root">
      {screen === 'home' && (
        <Home onStart={() => setScreen('create')} />
      )}

      {screen === 'create' && (
        <CreateInterview
          onBack={() => setScreen('home')}
          onCreate={handleCreate}
          loading={loading}
        />
      )}

      {screen === 'session' && session && (
        <QuestionSession
          session={session}
          onFinish={handleFinish}
          onCancel={() => setScreen('home')}
        />
      )}

      {error && (
        <div style={{ padding: 12, color: 'crimson' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {screen === 'result' && session && (
        <ResultSummary session={session} onRestart={handleRestart} />
      )}
    </div>
  )
}

export default App
