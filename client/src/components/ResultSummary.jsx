import React, { useRef } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { MdPictureAsPdf, MdShare } from 'react-icons/md'

function scoreSession(session) {
  const { questions = [], answers = [] } = session || {}
  let correctQuestions = 0
  const totalQuestions = questions.length
  let pointsEarned = 0
  let maxPoints = 0

  const details = questions.map((q) => {
    const answerEntry = answers.find((a) => a.id === q.id) || {}
    const given = answerEntry.answer

    if (q.type === 'mcq' || q.type === 'multiple_choice' || q.type === 'multiple-choice') {
      const isCorrect = Number(given) === Number(q.correctIndex)
      const weight = 1
      maxPoints += weight
      if (isCorrect) {
        correctQuestions += 1
        pointsEarned += weight
      }
      return { id: q.id, type: 'mcq', prompt: q.prompt || q.question, given, correctIndex: q.correctIndex, choices: q.choices || q.options, isCorrect }
    }

    // code questions: show given and model answer; attach grader feedback if present in answers
    const userSubmission = answerEntry.answer
    const modelAnswer = q.sampleAnswer || q.referenceSolution || null
    // determine correctness: prefer AI grader verdict; fallback to exact-ish match
    let isCorrect = false
    if (answerEntry.grade && answerEntry.grade.verdict) {
      isCorrect = String(answerEntry.grade.verdict).toLowerCase() === 'pass'
    } else if (userSubmission && modelAnswer) {
      const normalize = (s) => (s || '').toString().replace(/\s+/g, '').replace(/;+$/g, '').toLowerCase()
      try { if (normalize(userSubmission) === normalize(modelAnswer)) isCorrect = true } catch { /* ignore */ }
    }
    const weight = 5
    maxPoints += weight
    if (isCorrect) {
      correctQuestions += 1
      pointsEarned += weight
    }
    return { id: q.id, type: 'code', prompt: q.prompt || q.question, given: userSubmission, modelAnswer, grade: answerEntry.grade || null, isCorrect }
  })

  const percentCorrect = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0
  return { totalQuestions, correctQuestions, pointsEarned, maxPoints, percentCorrect, details }
}

export default function ResultSummary({ session, onRestart }) {
  const result = scoreSession(session)
  const captureRef = useRef(null)

  async function handleDownloadPdf() {
    const node = captureRef.current
    if (!node) return
    // Force light background for PDF readability
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let position = 0
    let heightLeft = imgHeight
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      pdf.addPage()
      position = heightLeft - imgHeight
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }
    const dt = new Date()
    const ts = dt.toISOString().replace(/[:T]/g, '-').split('.')[0]
    pdf.save(`interview-results-${ts}.pdf`)
  }

  async function handleShare() {
    try {
      const text = `Interview results\nPoints: ${result.pointsEarned} / ${result.maxPoints}\nCorrect: ${result.correctQuestions} / ${result.totalQuestions} (${result.percentCorrect}%)`
      if (navigator.share) {
        await navigator.share({ title: 'Interview Results', text })
        return
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        alert('Summary copied to clipboard.')
        return
      }
      // Fallback: open mailto
      const mailto = `mailto:?subject=${encodeURIComponent('Interview Results')}&body=${encodeURIComponent(text)}`
      window.location.href = mailto
    } catch (e) {
      console.warn('Share failed', e)
      alert('Unable to share. You can copy the summary manually.')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Results</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDownloadPdf}
            title="Download PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <MdPictureAsPdf size={18} />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handleShare}
            title="Share summary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <MdShare size={18} />
            <span>Share</span>
          </button>
        </div>
      </div>
      <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
        Scoring info: MCQs = 1 point each; Coding tasks = 5 points each.
      </div>
      <div ref={captureRef}>
        <p>
          Points: {result.pointsEarned} / {result.maxPoints}
        </p>
        <p>
          Correct: {result.correctQuestions} / {result.totalQuestions} ({result.percentCorrect}%)
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
      </div>

      <div>
        <button onClick={onRestart}>Done</button>
      </div>
    </div>
  )
}
