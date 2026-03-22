import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Timer from '../components/Timer'
import KBA from './KBA'
import type { KBAResult } from './KBA'
import PPA from './PPA'

interface AssessmentData {
  assessment_id: string
  mode: string
  expires_at: string
  questions: Array<{
    id: string
    text: string
    options: string[]
    pillar: string
  }>
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#000000',
    color: '#c0ffc0',
    fontFamily: "'Share Tech Mono', monospace",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    borderBottom: '1px solid rgba(0,255,65,0.1)',
    background: 'rgba(0,15,0,0.4)',
  },
  logo: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.7rem',
    color: '#00ff41',
    textShadow: '0 0 10px rgba(0,255,65,0.3)',
  },
  mode: {
    fontSize: '0.8rem',
    color: '#008f11',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
  },
  phaseIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    padding: '1rem',
    borderBottom: '1px solid rgba(0,255,65,0.05)',
  },
  phaseActive: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.6rem',
    color: '#00ff41',
    padding: '6px 14px',
    border: '1px solid rgba(0,255,65,0.3)',
    borderRadius: 4,
    background: 'rgba(0,255,65,0.08)',
  },
  phaseInactive: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.6rem',
    color: '#008f11',
    padding: '6px 14px',
    border: '1px solid rgba(0,255,65,0.08)',
    borderRadius: 4,
    opacity: 0.4,
  },
  content: {
    padding: '2rem',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.8rem',
    color: '#00ff41',
  },
  expired: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '1.5rem',
  },
  expiredTitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '1rem',
    color: '#ff4444',
  },
  expiredText: {
    color: '#c0ffc0',
    fontSize: '1rem',
  },
  homeButton: {
    padding: '12px 28px',
    borderRadius: 4,
    border: '1px solid rgba(0,255,65,0.2)',
    background: 'rgba(0,15,0,0.6)',
    color: '#00ff41',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  resultCard: {
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
    fontSize: '2rem',
    color: '#00ff41',
    textShadow: '0 0 30px rgba(0,255,65,0.4)',
    marginBottom: '1rem',
  },
  pillarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '0.75rem',
    marginTop: '1.5rem',
  },
  pillarItem: {
    padding: '0.75rem',
    border: '1px solid rgba(0,255,65,0.15)',
    borderRadius: 4,
    background: 'rgba(0,15,0,0.4)',
  },
  pillarLabel: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.6rem',
    color: '#008f11',
    marginBottom: '0.3rem',
  },
  pillarScore: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.85rem',
    color: '#00ff41',
  },
}

type Phase = 'kba' | 'ppa' | 'results'

export default function Assessment() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<AssessmentData | null>(null)
  const [phase, setPhase] = useState<Phase>('kba')
  const [expired, setExpired] = useState(false)
  const [kbaResult, setKbaResult] = useState<KBAResult | null>(null)

  useEffect(() => {
    // Load assessment data from sessionStorage
    const stored = sessionStorage.getItem('assessment')
    if (stored) {
      const parsed: AssessmentData = JSON.parse(stored)
      if (parsed.assessment_id === id) {
        setData(parsed)
        return
      }
    }
    // If no data, redirect to landing
    navigate('/')
  }, [id, navigate])

  const handleExpire = useCallback(() => {
    setExpired(true)
  }, [])

  const handleKBAComplete = useCallback((result: KBAResult) => {
    setKbaResult(result)
    setPhase('ppa')
  }, [])

  const handlePPAComplete = useCallback(() => {
    setPhase('results')
  }, [])

  if (!data) {
    return <div style={{ ...styles.page, ...styles.loading }}>[ LOADING... ]</div>
  }

  if (expired) {
    return (
      <div style={styles.page}>
        <div style={styles.expired}>
          <div style={styles.expiredTitle}>[ TIME EXPIRED ]</div>
          <div style={styles.expiredText}>Your assessment session has ended.</div>
          <button style={styles.homeButton} onClick={() => navigate('/')}>
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>PROMPTRANKS</span>
        <span style={styles.mode}>{data.mode} assessment</span>
        <Timer expiresAt={data.expires_at} onExpire={handleExpire} />
      </div>

      <div style={styles.phaseIndicator}>
        <span style={phase === 'kba' ? styles.phaseActive : styles.phaseInactive}>
          KBA
        </span>
        <span style={phase === 'ppa' ? styles.phaseActive : styles.phaseInactive}>
          PPA
        </span>
        {data.mode === 'full' && (
          <span style={styles.phaseInactive}>PSV</span>
        )}
        <span style={phase === 'results' ? styles.phaseActive : styles.phaseInactive}>
          RESULTS
        </span>
      </div>

      <div style={styles.content}>
        {phase === 'kba' && (
          <KBA
            assessmentId={data.assessment_id}
            questions={data.questions}
            onComplete={handleKBAComplete}
          />
        )}

        {phase === 'ppa' && (
          <PPA
            assessmentId={data.assessment_id}
            mode={data.mode}
            onComplete={handlePPAComplete}
          />
        )}

        {phase === 'results' && kbaResult && (
          <div style={styles.resultCard}>
            <div style={{ fontSize: '0.9rem', color: '#008f11', marginBottom: '0.5rem' }}>
              KBA SCORE
            </div>
            <div style={styles.scoreDisplay}>
              {Math.round(kbaResult.kba_score)}
            </div>
            <div style={{ color: '#c0ffc0', fontSize: '0.95rem' }}>
              {kbaResult.total_correct} / {kbaResult.total_questions} correct
            </div>
            <div style={styles.pillarGrid}>
              {Object.entries(kbaResult.pillar_scores).map(([pillar, data]) => (
                <div key={pillar} style={styles.pillarItem}>
                  <div style={styles.pillarLabel}>{pillar}</div>
                  <div style={styles.pillarScore}>{Math.round(data.score)}%</div>
                  <div style={{ fontSize: '0.7rem', color: '#008f11' }}>
                    {data.correct}/{data.total}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '2rem', color: '#008f11', fontSize: '0.85rem' }}>
              Scoring + Results coming in Sprint 3...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
