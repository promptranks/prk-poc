import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface BadgeData {
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

function getAvatarPalette(seed: string, level: number) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  const hueA = Math.abs(hash) % 360
  const hueB = (hueA + 70 + level * 12) % 360
  return {
    border: LEVEL_COLORS[level] || '#00ff41',
    glow: `hsla(${hueA}, 85%, 60%, 0.35)`,
    bg: `linear-gradient(135deg, hsla(${hueA}, 90%, 55%, 0.38), hsla(${hueB}, 90%, 58%, 0.18) 45%, rgba(0,0,0,0.72) 100%)`,
    accent: `hsl(${hueB}, 90%, 68%)`,
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, rgba(109,95,250,0.18), transparent 28%), #000000',
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
    marginBottom: '0.8rem',
  },
  eyebrow: {
    display: 'inline-block',
    padding: '0.45rem 0.75rem',
    borderRadius: 999,
    border: '1px solid rgba(0,255,65,0.16)',
    background: 'rgba(0,255,65,0.06)',
    color: '#84d98d',
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
    gap: '1rem',
  },
  card: {
    padding: '1.5rem',
    borderRadius: 18,
    border: '1px solid rgba(0,255,65,0.12)',
    background: 'linear-gradient(180deg, rgba(0,18,0,0.9), rgba(0,7,0,0.96))',
    boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
  },
  badgeStage: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  badgeWrap: {
    width: '100%',
    maxWidth: 460,
    padding: '0.8rem',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(14,16,26,0.95), rgba(6,6,10,0.98))',
  },
  actions: {
    display: 'flex',
    gap: '0.8rem',
    justifyContent: 'center',
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
  ctaButton: {
    padding: '11px 18px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #6D5FFA 0%, #8B5CF6 40%, #EC41FB 100%)',
    color: '#ffffff',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  copied: {
    color: '#00ff41',
    fontSize: '0.8rem',
    textAlign: 'center' as const,
    marginTop: '0.8rem',
  },
  sideCard: {
    padding: '1.5rem',
    borderRadius: 18,
    border: '1px solid rgba(109,95,250,0.24)',
    background: 'linear-gradient(180deg, rgba(17,10,31,0.92), rgba(5,6,14,0.98))',
    boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
  },
  sideTop: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    marginBottom: '1.3rem',
  },
  avatarFrame: {
    width: 88,
    height: 88,
    borderRadius: 20,
    padding: 3,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05))',
    boxShadow: '0 0 24px rgba(109,95,250,0.22)',
    flexShrink: 0,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  avatarFace: {
    position: 'absolute' as const,
    inset: '16px',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.18)',
  },
  avatarEyes: {
    position: 'absolute' as const,
    top: 30,
    left: 22,
    right: 22,
    display: 'flex',
    justifyContent: 'space-between',
  },
  eye: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 0 10px rgba(255,255,255,0.4)',
  },
  avatarMouth: {
    position: 'absolute' as const,
    left: 28,
    right: 28,
    bottom: 22,
    height: 10,
    borderBottom: '2px solid rgba(255,255,255,0.7)',
    borderRadius: '0 0 20px 20px',
  },
  sideTitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.8rem',
    color: '#ffffff',
    lineHeight: 1.7,
    margin: 0,
  },
  sideText: {
    marginTop: '0.55rem',
    color: '#c8befc',
    lineHeight: 1.65,
    fontSize: '0.9rem',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  statCard: {
    padding: '0.9rem',
    borderRadius: 12,
    border: '1px solid rgba(0,255,65,0.12)',
    background: 'rgba(0,15,0,0.35)',
  },
  statLabel: {
    color: '#78b681',
    fontSize: '0.75rem',
    marginBottom: '0.45rem',
    letterSpacing: '0.05em',
  },
  statValue: {
    color: '#F5FFF6',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.68rem',
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.7rem',
    color: '#00ff41',
    letterSpacing: '0.08em',
    margin: '1rem 0 0.8rem',
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
  note: {
    marginTop: '1rem',
    padding: '0.9rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: '#8ac892',
    fontSize: '0.82rem',
    lineHeight: 1.6,
  },
  loading: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.8rem',
    color: '#00ff41',
    padding: '4rem',
  },
  error: {
    color: '#ff4444',
    padding: '2rem',
    fontSize: '0.95rem',
    textAlign: 'center' as const,
  },
}

export default function Badge() {
  const navigate = useNavigate()
  const { badgeId } = useParams<{ badgeId: string }>()
  const [badge, setBadge] = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const res = await fetch(`${API_URL}/badges/verify/${badgeId}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || 'Badge not found')
        }
        const data: BadgeData = await res.json()
        setBadge(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchBadge()
  }, [badgeId])

  const verifyUrl = `${window.location.origin}/verify/${badgeId}`

  const pillarValues = useMemo(
    () => (badge ? PILLARS.map((pillar) => ({ pillar, value: getPillarValue(badge.pillar_scores, pillar) })) : []),
    [badge],
  )

  const avatarPalette = useMemo(
    () => getAvatarPalette(badge?.badge_id || 'promptranks', badge?.level || 1),
    [badge],
  )

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(verifyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadSvg = () => {
    if (!badge?.badge_svg) return
    const blob = new Blob([badge.badge_svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `promptranks-badge-L${badge.level}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div style={{ ...styles.page, justifyContent: 'center' }}><div style={styles.loading}>[ LOADING BADGE... ]</div></div>
  }

  if (error || !badge) {
    return <div style={{ ...styles.page, justifyContent: 'center' }}><div style={styles.error}>{error || 'Badge not found'}</div></div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.logo}>PROMPTRANKS</div>
          <div style={styles.eyebrow}>VERIFIABLE SKILL BADGE</div>
        </div>

        <div style={styles.layout}>
          <div style={styles.card}>
            <div style={styles.badgeStage}>
              <div style={styles.badgeWrap}>
                <div dangerouslySetInnerHTML={{ __html: badge.badge_svg }} />
              </div>
            </div>

            <div style={styles.actions}>
              <button style={styles.ctaButton} onClick={handleCopyUrl}>
                Copy Verify URL
              </button>
              <button style={styles.button} onClick={handleDownloadSvg}>
                Download SVG
              </button>
              {badge.mode.toLowerCase() === 'full' && (
                <button style={styles.button} onClick={() => navigate('/leaderboard')}>
                  See Your Rank
                </button>
              )}
            </div>

            {copied && <div style={styles.copied}>Verification URL copied to clipboard</div>}
          </div>

          <div style={styles.sideCard}>
            <div style={styles.sideTop}>
              <div style={styles.avatarFrame}>
                <div style={{ ...styles.avatarInner, background: avatarPalette.bg, border: `1px solid ${avatarPalette.border}` }}>
                  <div style={{ ...styles.avatarFace, boxShadow: `0 0 18px ${avatarPalette.glow}` }} />
                  <div style={styles.avatarEyes}>
                    <div style={{ ...styles.eye, background: avatarPalette.accent }} />
                    <div style={{ ...styles.eye, background: avatarPalette.accent }} />
                  </div>
                  <div style={{ ...styles.avatarMouth, borderBottomColor: avatarPalette.accent }} />
                </div>
              </div>
              <div>
                <h1 style={styles.sideTitle}>L{badge.level} · {badge.level_name}</h1>
                <div style={styles.sideText}>
                  This badge is live, shareable, and tied to a public verification route. The portrait block is a deterministic avatar placeholder for future profile personalization.
                </div>
              </div>
            </div>

            <div style={styles.statGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>FINAL SCORE</div>
                <div style={{ ...styles.statValue, color: LEVEL_COLORS[badge.level] || '#00ff41' }}>{Math.round(badge.final_score)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>MODE</div>
                <div style={styles.statValue}>{badge.mode.toLowerCase() === 'full' ? 'CERTIFIED' : 'ESTIMATED'}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>ISSUED</div>
                <div style={styles.statValue}>{new Date(badge.issued_at).toLocaleDateString()}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>STATUS</div>
                <div style={{ ...styles.statValue, color: '#00ff41' }}>VALID</div>
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

            <div style={styles.note}>
              Verify URL: {verifyUrl}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
