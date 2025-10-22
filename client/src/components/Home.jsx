import React, { useEffect, useState } from 'react'
import '../styles/home.css'

export default function Home({ onStart }) {
  return (
    <div className="home-root">
      <header className="site-header container">
        <div className="brand">interviewai.bg</div>
 
   
      </header>

      <main className="container">
        <section className="hero">
          <div className="hero-left">
            <h1 className="hero-title">Build AI-generated programming interviews</h1>
            <p className="hero-sub">Generate multiple-choice and coding tasks tailored to language, role and framework. Fast, customizable, and developer-friendly.</p>

            <div className="cta-row">
              <button className="btn btn-primary" onClick={onStart}>Create Interview</button>
             
            </div>
          </div>

          <div className="hero-right">
            {/* Carousel: cycles through sampleQuestions every 1s */}
            <div className="mockup-card carousel">
              <div className="mockup-header">Sample questions</div>
              <div className="mockup-body">
                <Carousel />
              </div>
            </div>
          </div>
        </section>

        <section className="features">
          <div className="feature">
            <div className="feat-icon">⚡</div>
            <h3>AI-generated questions</h3>
            <p>Create tailored tests instantly for any language or role.</p>
          </div>

          <div className="feature">
            <div className="feat-icon">🧩</div>
            <h3>Mixed question types</h3>
            <p>Multiple-choice and coding/markup tasks in a single interview.</p>
          </div>

          <div className="feature">
            <div className="feat-icon">💭</div>
            <h3>Share & review</h3>
            <p>You can share adn send interview result.</p>
          </div>
        </section>
      </main>

      <footer className="footer container">
        <div>© {new Date().getFullYear()} Interview.ai — Minimal Dark</div>
      </footer>
    </div>
  )
}

function Carousel() {
  const sampleQuestions = [
    { q: 'Which SQL clause filters rows based on a condition?', choices: ['WHERE', 'GROUP BY', 'ORDER BY', 'HAVING'] },
    { q: 'Which SQL statement is used to remove a table?', choices: ['DROP TABLE', 'DELETE TABLE', 'REMOVE TABLE', 'TRUNCATE TABLE'] },
    { q: 'Which SQL function returns the number of rows?', choices: ['COUNT()', 'SUM()', 'ROWNUM()', 'TOTAL()'] },
    { q: 'Which clause is used to sort the result set?', choices: ['ORDER BY', 'GROUP BY', 'SORT BY', 'ARRANGE BY'] },
    { q: 'Which join returns all rows from left table and matching rows from right?', choices: ['LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN'] },
    { q: 'How to select unique values from a column?', choices: ['SELECT DISTINCT', 'SELECT UNIQUE', 'SELECT DIFFERENT', 'SELECT ONLY'] },
    { q: 'Which statement adds a new column to an existing table?', choices: ['ALTER TABLE ADD COLUMN', 'UPDATE TABLE ADD', 'ADD COLUMN TO', 'MODIFY TABLE ADD'] },
    { q: 'Which keyword limits the number of returned rows?', choices: ['LIMIT', 'TOP', 'ROWNUM', 'FETCH FIRST'] },
    { q: 'Which index type is suitable for equality comparisons?', choices: ['Hash index', 'B-tree index', 'GiST', 'GIN'] },
    { q: 'How to rename a column in SQL (standard)?', choices: ['ALTER TABLE RENAME COLUMN', 'RENAME COLUMN', 'MODIFY COLUMN NAME', 'CHANGE COLUMN NAME'] },
  ]

  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % sampleQuestions.length)
    }, 4000)
    return () => clearInterval(t)
  }, [sampleQuestions.length])

  return (
    <div className="carousel-inner" tabIndex={0}>
      {sampleQuestions.map((s, i) => (
        <div key={i} className={`slide ${i === idx ? 'active' : ''}`} aria-hidden={i === idx ? 'false' : 'true'}>
          <div className="question">{s.q}</div>
          <ul className="choices">
            {s.choices.map((c, j) => (
              <li key={j} className={j === 0 ? 'correct' : ''}>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
