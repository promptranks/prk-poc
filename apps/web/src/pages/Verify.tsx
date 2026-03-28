import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface VerifyData {
  badge_id: string
  mode: string
  level: number
  level_name: string
  final_score: number
  pillar_scores: Record<string, unknown>
  badge_svg: string
  issued_at: string
  valid: boolean
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#666666',
  2: '#008f11',
  3: '#00ff41',
  4: '#6D5FFA',
  5: '#EC41FB',
}

const PILLARS = ['P', 'E', 'C', 'A', 'M'] as const

function getPillarValue(pillarScores: Record<string, unknown>, pillar: string): number {
  const raw = pillarScores[pillar]
  if (typeof raw === 'number') return raw
  if (raw && typeof raw === 'object' && 'combined' in raw) {
    const combined = (raw as { combined?: unknown }).combined
    return typeof combined === 'number' ? combined : 0
  }
  return 0
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, rgba(109,95,250,0.15), transparent 26%), #000000',
    color: '#c0ffc0',
    fontFamily: "'Share Tech Mono', monospace",
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '2rem 1rem 4rem',
  },
  shell: {
    width: '100%',
    maxWidth: 1120,
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
  },
  logo: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.8rem',
    color: '#00ff41',
    textShadow: '0 0 10px rgba(0,255,65,0.3)',
    marginBottom: '0.55rem',
  },
  subtitle: {
    color: '#7dc386',
    fontSize: '0.9rem',
  },
  validBadge: {
    display: 'inline-block',
    padding: '7px 16px',
    borderRadius: 999,
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.56rem',
    letterSpacing: '0.12em',
    marginTop: '0.9rem',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
    gap: '1rem',
  },
  card: {
    padding: '1.5rem',
    borderRadius: 18,
    border: '1px solid rgba(0,255,65,0.12)',
    background: 'linear-gradient(180deg, rgba(0,18,0,0.9), rgba(0,8,0,0.96))',
    boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
  },
  badgeWrap: {
    maxWidth: 460,
    margin: '0 auto',
    padding: '0.8rem',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(14,16,26,0.95), rgba(6,6,10,0.98))',
  },
  sideCard: {
    padding: '1.5rem',
    borderRadius: 18,
    border: '1px solid rgba(109,95,250,0.24)',
    background: 'linear-gradient(180deg, rgba(17,10,31,0.92), rgba(5,6,14,0.98))',
    boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
  },
  sectionTitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.7rem',
    color: '#00ff41',
    letterSpacing: '0.08em',
    margin: '0 0 0.85rem',
  },
  lead: {
    color: '#c7bcff',
    fontSize: '0.92rem',
    lineHeight: 1.7,
    margin: '0 0 1rem',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  detailCard: {
    padding: '0.9rem',
    borderRadius: 12,
    border: '1px solid rgba(0,255,65,0.12)',
    background: 'rgba(0,15,0,0.35)',
  },
  detailLabel: {
    color: '#78b681',
    fontSize: '0.75rem',
    marginBottom: '0.45rem',
  },
  detailValue: {
    color: '#F5FFF6',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.68rem',
    lineHeight: 1.5,
  },
  pillarList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  pillarRow: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) 46px',
    gap: '0.7rem',
    alignItems: 'center',
  },
  pillarLabel: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.62rem',
    color: '#00ff41',
  },
  pillarTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(0,255,65,0.08)',
    overflow: 'hidden' as const,
  },
  pillarFill: (value: number) => ({
    height: '100%',
    width: `${Math.max(6, Math.min(100, value))}%`,
    borderRadius: 999,
    background: value >= 85
      ? 'linear-gradient(90deg, #6D5FFA, #EC41FB)'
      : value >= 70
      ? 'linear-gradient(90deg, #00c853, #00ff41)'
      : '#008f11',
  }),
  pillarValue: {
    color: '#9fe6a8',
    fontSize: '0.8rem',
    textAlign: 'right' as const,
  },
  actionRow: {
    display: 'flex',
    gap: '0.8rem',
    marginTop: '1rem',
    flexWrap: 'wrap' as const,
  },
  button: {
    padding: '11px 18px',
    borderRadius: 10,
    border: '1px solid rgba(0,255,65,0.18)',
    background: 'rgba(0,15,0,0.6)',
    color: '#00ff41',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  loading: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.8rem',
    color: '#00ff41',
    padding: '4rem',
  },
  error: {
    textAlign: 'center' as const,
    maxWidth: 500,
    padding: '2rem',
  },
  errorTitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.85rem',
    color: '#ff4444',
    marginBottom: '1rem',
  },
  errorText: {
    color: '#c0ffc0',
    fontSize: '0.9rem',
  },
}

export default function Verify() {
  const navigate = useNavigate()
  const { badgeId } = useParams<{ badgeId: string }>()
  const [data, setData] = useState<VerifyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`${API_URL}/badges/verify/${badgeId}`)
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.detail || 'Verification failed')
        }
        const json: VerifyData = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [badgeId])

  const pillarValues = useMemo(
    () => (data ? PILLARS.map((pillar) => ({ pillar, value: getPillarValue(data.pillar_scores, pillar) })) : []),
    [data],
  )

  if (loading) {
    return <div style={{ ...styles.page, justifyContent: 'center' }}><div style={styles.loading}>[ VERIFYING... ]</div></div>
  }

  if (error || !data) {
    return (
      <div style={{ ...styles.page, justifyContent: 'center' }}>
        <div style={styles.error}>
          <div style={styles.errorTitle}>VERIFICATION FAILED</div>
          <div style={styles.errorText}>{error || 'Badge not found'}</div>
        </div>
      </div>
    )
  }

  const levelColor = LEVEL_COLORS[data.level] || '#00ff41'

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.logo}>PROMPTRANKS</div>
          <div style={styles.subtitle}>Badge Verification</div>
          <div
            style={{
              ...styles.validBadge,
              color: '#00ff41',
              border: '1px solid #00ff41',
              background: 'rgba(0,255,65,0.08)',
              textShadow: '0 0 10px rgba(0,255,65,0.4)',
            }}
          >
            VERIFIED
          </div>
        </div>

        <div style={styles.layout}>
          <div style={styles.card}>
            <div style={styles.badgeWrap}>
              <div dangerouslySetInnerHTML={{ __html: data.badge_svg }} />
            </div>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.sectionTitle}>VERIFICATION DETAILS</div>
            <p style={styles.lead}>
              This credential resolves to a valid PromptRanks record and can be shared as public proof of assessed prompting skill.
            </p>

            <div style={styles.detailGrid}>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>STATUS</div>
                <div style={{ ...styles.detailValue, color: '#00ff41' }}>VALID</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>MODE</div>
                <div style={styles.detailValue}>{data.mode === 'full' ? 'CERTIFIED' : 'ESTIMATED'}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>LEVEL</div>
                <div style={{ ...styles.detailValue, color: levelColor }}>L{data.level} · {data.level_name}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>SCORE</div>
                <div style={styles.detailValue}>{Math.round(data.final_score)}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>ISSUED</div>
                <div style={styles.detailValue}>{new Date(data.issued_at).toLocaleDateString()}</div>
              </div>
              <div style={styles.detailCard}>
                <div style={styles.detailLabel}>BADGE ID</div>
                <div style={styles.detailValue}>{data.badge_id.slice(0, 8).toUpperCase()}</div>
              </div>
            </div>

            <div style={styles.sectionTitle}>PECAM BREAKDOWN</div>
            <div style={styles.pillarList}>
              {pillarValues.map(({ pillar, value }) => (
                <div key={pillar} style={styles.pillarRow}>
                  <div style={styles.pillarLabel}>{pillar}</div>
                  <div style={styles.pillarTrack}>
                    <div style={styles.pillarFill(value)} />
                  </div>
                  <div style={styles.pillarValue}>{Math.round(value)}</div>
                </div>
              ))}
            </div>

            <div style={styles.actionRow}>
              <button style={styles.button} onClick={() => navigate(`/badge/${data.badge_id}`)}>
                Open Badge Page
              </button>
              <button style={styles.button} onClick={() => navigate('/leaderboard')}>
                View Ladder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
