import { useState, useCallback, useEffect } from 'react'
import PromptEditor from '../components/PromptEditor'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface TaskBrief {
  task_id: string
  external_id: string
  title: string
  pillar: string
  pillars_tested: string[]
  difficulty: number
  brief: string
  input_data: string
  success_criteria: string[]
  max_attempts: number
}

interface Attempt {
  attempt: number
  prompt: string
  output: string
}

interface PPAProps {
  assessmentId: string
  mode: string
  onComplete: () => void
}

export interface PPAResult {
  ppa_score: number
  dimensions: Record<string, { score: number; rationale: string }>
}

const styles = {
  wrapper: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0.5rem',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '3rem',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.8rem',
    color: '#00ff41',
  },
  error: {
    color: '#ff4444',
    fontSize: '0.9rem',
    marginBottom: '1rem',
    textAlign: 'center' as const,
    padding: '1rem',
    border: '1px solid rgba(255,68,68,0.3)',
    borderRadius: 4,
    background: 'rgba(255,0,0,0.05)',
  },
  taskHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    border: '1px solid rgba(0,255,65,0.1)',
    borderRadius: 4,
    background: 'rgba(0,15,0,0.4)',
  },
  taskTitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.65rem',
    color: '#00ff41',
  },
  attemptBadge: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.6rem',
    color: '#008f11',
    padding: '4px 10px',
    border: '1px solid rgba(0,255,65,0.2)',
    borderRadius: 4,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    minHeight: 500,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  card: {
    padding: '1rem',
    border: '1px solid rgba(0,255,65,0.15)',
    borderRadius: 8,
    background: 'rgba(0,15,0,0.6)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
  },
  sectionLabel: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.55rem',
    color: '#008f11',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    marginBottom: '0.75rem',
  },
  briefText: {
    fontSize: '0.9rem',
    color: '#c0ffc0',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap' as const,
    fontFamily: "'Share Tech Mono', monospace",
  },
  inputDataBox: {
    padding: '0.75rem',
    border: '1px solid rgba(0,255,65,0.1)',
    borderRadius: 4,
    background: 'rgba(0,5,0,0.6)',
    fontSize: '0.8rem',
    color: '#c0ffc0',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    fontFamily: "'Share Tech Mono', monospace",
    maxHeight: 200,
    overflow: 'auto' as const,
  },
  criteriaList: {
    listStyle: 'none' as const,
    padding: 0,
    margin: 0,
  },
  criteriaItem: {
    fontSize: '0.8rem',
    color: '#c0ffc0',
    padding: '4px 0',
    fontFamily: "'Share Tech Mono', monospace",
  },
  outputBox: {
    padding: '1rem',
    border: '1px solid rgba(0,255,65,0.15)',
    borderRadius: 4,
    background: 'rgba(0,5,0,0.8)',
    fontSize: '0.85rem',
    color: '#c0ffc0',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    fontFamily: "'Share Tech Mono', monospace",
    minHeight: 100,
    maxHeight: 300,
    overflow: 'auto' as const,
  },
  emptyOutput: {
    color: '#008f11',
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    padding: '2rem',
    fontSize: '0.8rem',
  },
  attemptTabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  attemptTab: {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid rgba(0,255,65,0.15)',
    background: 'rgba(0,15,0,0.4)',
    color: '#008f11',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  attemptTabActive: {
    border: '1px solid rgba(109,95,250,0.6)',
    background: 'rgba(109,95,250,0.15)',
    color: '#fff',
  },
  submitBestButton: {
    width: '100%',
    padding: '14px',
    borderRadius: 4,
    border: 'none',
    background: 'linear-gradient(135deg, #6D5FFA 0%, #8B5CF6 40%, #EC41FB 100%)',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: "'Share Tech Mono', monospace",
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  disabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  pillarBadges: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  pillarBadge: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.5rem',
    padding: '3px 8px',
    borderRadius: 3,
    border: '1px solid rgba(0,255,65,0.3)',
    color: '#00ff41',
    background: 'rgba(0,255,65,0.08)',
  },
  taskNav: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  taskNavButton: {
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid rgba(0,255,65,0.2)',
    background: 'rgba(0,15,0,0.4)',
    color: '#008f11',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.55rem',
    cursor: 'pointer',
  },
  taskNavActive: {
    border: '1px solid rgba(0,255,65,0.4)',
    background: 'rgba(0,255,65,0.08)',
    color: '#00ff41',
  },
  taskNavDone: {
    border: '1px solid rgba(109,95,250,0.4)',
    background: 'rgba(109,95,250,0.1)',
    color: '#8B5CF6',
  },
  completeCard: {
    maxWidth: 600,
    margin: '2rem auto',
    padding: '2rem',
    border: '1px solid rgba(0,255,65,0.2)',
    borderRadius: 8,
    background: 'rgba(0,15,0,0.6)',
    textAlign: 'center' as const,
  },
  scoreDisplay: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '1.5rem',
    color: '#00ff41',
    textShadow: '0 0 30px rgba(0,255,65,0.4)',
    marginBottom: '1rem',
  },
}

export default function PPA({ assessmentId, mode, onComplete }: PPAProps) {
  const [tasks, setTasks] = useState<TaskBrief[]>([])
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [executing, setExecuting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Per-task state: attempts and selected best
  const [taskAttempts, setTaskAttempts] = useState<Record<string, Attempt[]>>({})
  const [viewingAttempt, setViewingAttempt] = useState<Record<string, number>>({})
  const [judgedTasks, setJudgedTasks] = useState<Record<string, PPAResult>>({})
  const [allDone, setAllDone] = useState(false)

  // Fetch tasks on mount
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch(`${API_BASE}/assessments/${assessmentId}/ppa/tasks`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || 'Failed to load PPA tasks')
        }
        const data = await res.json()
        setTasks(data.tasks)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load tasks'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    fetchTasks()
  }, [assessmentId])

  const currentTask = tasks[currentTaskIndex]
  const currentAttempts = currentTask ? (taskAttempts[currentTask.task_id] || []) : []
  const currentViewing = currentTask ? (viewingAttempt[currentTask.task_id] ?? -1) : -1
  const isJudged = currentTask ? !!judgedTasks[currentTask.task_id] : false

  const handleExecute = useCallback(async (prompt: string) => {
    if (!currentTask) return
    setExecuting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/assessments/${assessmentId}/ppa/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: currentTask.task_id, prompt }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Execution failed')
      }
      const data = await res.json()
      const newAttempt: Attempt = {
        attempt: data.attempt_number,
        prompt,
        output: data.output,
      }
      setTaskAttempts(prev => ({
        ...prev,
        [currentTask.task_id]: [...(prev[currentTask.task_id] || []), newAttempt],
      }))
      // View the new attempt
      setViewingAttempt(prev => ({
        ...prev,
        [currentTask.task_id]: (prev[currentTask.task_id] ?? -1) + 1,
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Execution failed'
      setError(message)
    } finally {
      setExecuting(false)
    }
  }, [assessmentId, currentTask])

  const handleSubmitBest = useCallback(async () => {
    if (!currentTask || currentAttempts.length === 0) return
    const attemptIndex = currentViewing >= 0 ? currentViewing : currentAttempts.length - 1

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/assessments/${assessmentId}/ppa/submit-best`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTask.task_id,
          attempt_index: attemptIndex,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Submission failed')
      }
      const data = await res.json()
      setJudgedTasks(prev => ({
        ...prev,
        [currentTask.task_id]: {
          ppa_score: data.ppa_score,
          dimensions: data.dimensions,
        },
      }))

      // Check if all tasks are judged
      const totalJudged = Object.keys(judgedTasks).length + 1
      if (totalJudged >= tasks.length) {
        setAllDone(true)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }, [assessmentId, currentTask, currentAttempts, currentViewing, judgedTasks, tasks.length])

  if (loading) {
    return <div style={styles.loading}>[ LOADING PPA TASKS... ]</div>
  }

  if (allDone) {
    return (
      <div style={styles.completeCard}>
        <div style={{ fontSize: '0.9rem', color: '#008f11', marginBottom: '0.5rem' }}>
          PPA PHASE COMPLETE
        </div>
        <div style={styles.scoreDisplay}>
          {Math.round(
            Object.values(judgedTasks).reduce((sum, r) => sum + r.ppa_score, 0) / Object.values(judgedTasks).length
          )}
        </div>
        <div style={{ color: '#c0ffc0', marginBottom: '1.5rem' }}>
          All tasks judged successfully
        </div>
        <button
          style={styles.submitBestButton}
          onClick={onComplete}
        >
          [ CONTINUE TO RESULTS ]
        </button>
      </div>
    )
  }

  if (!currentTask) {
    return <div style={styles.loading}>No PPA tasks available</div>
  }

  const viewedOutput = currentViewing >= 0 && currentViewing < currentAttempts.length
    ? currentAttempts[currentViewing].output
    : null

  return (
    <div style={styles.wrapper}>
      {error && <div style={styles.error}>{error}</div>}

      {/* Task navigation (for multi-task full mode) */}
      {tasks.length > 1 && (
        <div style={styles.taskNav}>
          {tasks.map((t, i) => (
            <button
              key={t.task_id}
              style={{
                ...styles.taskNavButton,
                ...(i === currentTaskIndex ? styles.taskNavActive : {}),
                ...(judgedTasks[t.task_id] ? styles.taskNavDone : {}),
              }}
              onClick={() => setCurrentTaskIndex(i)}
            >
              TASK {i + 1}
            </button>
          ))}
        </div>
      )}

      <div style={styles.taskHeader}>
        <div>
          <div style={styles.taskTitle}>{currentTask.title}</div>
          <div style={styles.pillarBadges}>
            {currentTask.pillars_tested.map(p => (
              <span key={p} style={styles.pillarBadge}>{p}</span>
            ))}
          </div>
        </div>
        <div style={styles.attemptBadge}>
          {currentAttempts.length} / {currentTask.max_attempts} attempts
        </div>
      </div>

      <div style={styles.layout}>
        {/* Left: Task brief + prompt editor */}
        <div style={styles.panel}>
          <div style={styles.card}>
            <div style={styles.sectionLabel}>Task Brief</div>
            <div style={styles.briefText}>{currentTask.brief}</div>
          </div>

          {currentTask.input_data && (
            <div style={styles.card}>
              <div style={styles.sectionLabel}>Input Data</div>
              <div style={styles.inputDataBox}>{currentTask.input_data}</div>
            </div>
          )}

          <div style={styles.card}>
            <div style={styles.sectionLabel}>Success Criteria</div>
            <ul style={styles.criteriaList}>
              {currentTask.success_criteria.map((c, i) => (
                <li key={i} style={styles.criteriaItem}>
                  {'>'} {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Editor + output */}
        <div style={styles.panel}>
          <div style={{ ...styles.card, flex: 1 }}>
            <PromptEditor
              onExecute={handleExecute}
              disabled={isJudged || currentAttempts.length >= currentTask.max_attempts}
              executing={executing}
            />
          </div>

          <div style={styles.card}>
            <div style={styles.sectionLabel}>LLM Output</div>

            {currentAttempts.length > 0 && (
              <div style={styles.attemptTabs}>
                {currentAttempts.map((_, i) => (
                  <button
                    key={i}
                    style={{
                      ...styles.attemptTab,
                      ...(currentViewing === i ? styles.attemptTabActive : {}),
                    }}
                    onClick={() => setViewingAttempt(prev => ({
                      ...prev,
                      [currentTask.task_id]: i,
                    }))}
                  >
                    Attempt {i + 1}
                  </button>
                ))}
              </div>
            )}

            <div style={styles.outputBox}>
              {viewedOutput ? (
                viewedOutput
              ) : (
                <div style={styles.emptyOutput}>
                  Output will appear here after execution...
                </div>
              )}
            </div>
          </div>

          {/* Submit best button */}
          {currentAttempts.length > 0 && !isJudged && (
            <button
              style={{
                ...styles.submitBestButton,
                ...(submitting ? styles.disabled : {}),
              }}
              onClick={handleSubmitBest}
              disabled={submitting}
            >
              {submitting
                ? '[ JUDGING... ]'
                : `[ SUBMIT ATTEMPT ${(currentViewing >= 0 ? currentViewing : currentAttempts.length - 1) + 1} AS BEST ]`}
            </button>
          )}

          {isJudged && (
            <div style={{
              ...styles.card,
              borderColor: 'rgba(109,95,250,0.3)',
              background: 'rgba(109,95,250,0.05)',
              textAlign: 'center' as const,
            }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.6rem', color: '#8B5CF6', marginBottom: '0.5rem' }}>
                TASK JUDGED
              </div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '1.2rem', color: '#00ff41' }}>
                {Math.round(judgedTasks[currentTask.task_id].ppa_score)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
