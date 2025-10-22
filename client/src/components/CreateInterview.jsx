import React, { useState } from 'react'
import '../styles/create.css'

export default function CreateInterview({ onBack, onCreate }) {
  const [language, setLanguage] = useState('')
  const [role, setRole] = useState('frontend')
  const [framework, setFramework] = useState('')
  const [numQuestions, setNumQuestions] = useState(5)

  const roleOptions = [
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend', label: 'Backend' },
    { value: 'fullstack', label: 'Fullstack' },
    { value: 'database', label: 'Database' },
    { value: 'devops', label: 'DevOps' },
    { value: 'other', label: 'Other' },
  ]

  const frameworkMap = {
    javascript: ['React', 'Next.js', 'React Native', 'Angular', 'Vue', 'Svelte', 'Plain JS'],
    python: ['Django', 'Flask', 'FastAPI'],
    java: ['Spring', 'Jakarta EE'],
    csharp: ['.NET'],
    sql: ['MySQL', 'PostgreSQL', 'SQLite'],
  }

  const frameworksForLanguage = frameworkMap[language] || []

  function roleToLanguage(r) {
    if (!r) return ''
    if (r === 'database') return 'sql'
    if (r === 'frontend') return 'html'
    if (r === 'backend') return 'javascript'
    if (r === 'fullstack') return 'javascript'
    if (r === 'devops') return 'devops'
    return ''
  }

  function submit(e) {
    e.preventDefault()
    const effectiveLanguage = language || roleToLanguage(role)
    onCreate({ language: effectiveLanguage, role, framework, numQuestions })
  }

  return (
    <div className="create-wrap container">
      <div className="create-card">
        <h2>Create Interview</h2>
        <form onSubmit={submit} className="create-grid">
          <div className="field">
            <label className="small">Programming language</label>
            <select value={language} onChange={(e) => { setLanguage(e.target.value); setFramework('') }}>
              <option value="">(auto — choose based on Role)</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option value="sql">SQL</option>
              <option value="html">HTML/CSS</option>
            </select>
            <div className="muted-note">Leave blank to auto-select from Role</div>
          </div>

          <div className="field">
            <label className="small">Role (optional)</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="small">Framework / Technology (optional)</label>
            <select value={framework} onChange={(e) => setFramework(e.target.value)}>
              <option value="">(none)</option>
              {frameworksForLanguage.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="small">Number of questions</label>
            <input
              type="number"
              value={numQuestions}
              min={1}
              max={20}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
            />
          </div>

          <div className="actions">
            <button type="button" onClick={onBack} className="back-btn">Back</button>
            <button type="submit" className="primary-btn">Generate Questions</button>
          </div>
        </form>
      </div>
    </div>
  )
}
