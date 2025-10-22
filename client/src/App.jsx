import { useState } from 'react'
import './App.css'
import Home from './components/Home'
import CreateInterview from './components/CreateInterview'
import QuestionSession from './components/QuestionSession'
import ResultSummary from './components/ResultSummary'
import { generateQuestions } from './lib/aiClient'

function App() {
  const [screen, setScreen] = useState('home') // home | create | session | result
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)

  async function handleCreate(config) {
    setError(null)
    try {
      // Generate questions (mock or real depending on config)
      const result = await generateQuestions(config)
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
      setError(err.message || String(err))
    }
  }

  function handleFinish(answers) {
    // compute results here or in ResultSummary
    setSession((s) => ({ ...s, answers }))
    setScreen('result')
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
