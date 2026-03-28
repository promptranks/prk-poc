import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PERIODS = [
  { value: 'alltime', label: 'All Time' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'quarterly', label: 'This Quarter' },
]

const LEVEL_LABELS: Record<number, string> = {
  1: 'NOVICE',
  2: 'PRACTITIONER',
  3: 'PROFICIENT',
  4: 'EXPERT',
  5: 'MASTER',
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#64748B',
  2: '#10B981',
  3: '#3BB9FB',
  4: '#8B5CF6',
  5: '#EC41FB',
}

const RANK_COLORS: Record<number, string> = {
  1: '#F59E0B',
  2: '#CBD5E1',
  3: '#F97316',
}

const GRADIENT_TEXT = 'linear-gradient(135deg, #A78BFA 0%, #60A5FA 50%, #EC41FB 100%)'
const PRIMARY_GRADIENT = 'linear-gradient(135deg, #6D5FFA 0%, #8B5CF6 50%, #EC41FB 100%)'
const PAGE_BG = 'linear-gradient(160deg, #07091A 0%, #0E0B2E 40%, #0A0714 100%)'

interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  level: number
  level_name: string
  score: number
  pillar_scores: Record<string, number | Record<string, number>>
  badge_id: string
  achieved_at: string
}

interface MyRank {
  rank: number
  score: number
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  total: number
  page: number
  page_size: number
  period: string
  my_rank: MyRank | null
}

const styles = {
  page: {
    minHeight: '100vh',
    background: PAGE_BG,
    color: '#F1F5F9',
    fontFamily: 'Inter, system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  blob: (top: string, left: string, size: number, color: string) => ({
    position: 'absolute' as const,
    top,
    left,
    width: size,
    height: size,
    borderRadius: '50%',
    background: color,
    filter: 'blur(80px)',
    opacity: 0.42,
    pointerEvents: 'none' as const,
  }),
  container: {
    position: 'relative' as const,
    zIndex: 1,
    maxWidth: 1200,
    width: '100%',
    padding: '2rem 1.5rem 4rem',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    marginBottom: '1.5rem',
    color: '#94A3B8',
    fontSize: '0.95rem',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  glassCard: {
    background: 'rgba(17,20,40,0.72)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 22,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  heroPanel: {
    padding: '1.75rem',
  },
  heroTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.5rem 0.85rem',
    borderRadius: 999,
    background: 'rgba(109,95,250,0.12)',
    border: '1px solid rgba(109,95,250,0.26)',
    color: '#C4B5FD',
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: '1rem',
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#10B981',
    boxShadow: '0 0 14px rgba(16,185,129,0.7)',
  },
  heading: {
    fontSize: 'clamp(2.4rem, 5vw, 4rem)',
    lineHeight: 1.02,
    fontWeight: 900,
    margin: '0 0 1rem',
    letterSpacing: '-0.04em',
  },
  gradientText: {
    background: GRADIENT_TEXT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '1.08rem',
    color: '#94A3B8',
    lineHeight: 1.7,
    margin: 0,
    maxWidth: 720,
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.85rem',
    marginTop: '1.35rem',
  },
  statCard: {
    padding: '1rem 1.05rem',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.03)',
  },
  statValue: {
    fontSize: '1.15rem',
    fontWeight: 800,
    color: '#F8FAFC',
    marginBottom: '0.35rem',
  },
  statLabel: {
    fontSize: '0.85rem',
    color: '#94A3B8',
    lineHeight: 1.5,
  },
  sidePanel: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    gap: '1rem',
  },
  sideTitle: {
    fontSize: '0.8rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: '#A78BFA',
    margin: '0 0 0.8rem',
  },
  sideCopy: {
    color: '#CBD5E1',
    fontSize: '0.95rem',
    lineHeight: 1.7,
    margin: 0,
  },
  sideBadgeRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.6rem',
  },
  sideBadge: (color: 'purple' | 'cyan' | 'green') => ({
    padding: '0.45rem 0.8rem',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: color === 'purple' ? '#C4B5FD' : color === 'cyan' ? '#7DD3FC' : '#6EE7B7',
    background: color === 'purple'
      ? 'rgba(109,95,250,0.15)'
      : color === 'cyan'
      ? 'rgba(59,185,251,0.15)'
      : 'rgba(16,185,129,0.15)',
    border: color === 'purple'
      ? '1px solid rgba(109,95,250,0.28)'
      : color === 'cyan'
      ? '1px solid rgba(59,185,251,0.28)'
      : '1px solid rgba(16,185,129,0.28)',
  }),
  tabRow: {
    display: 'flex',
    gap: '0.7rem',
    flexWrap: 'wrap' as const,
    margin: '1.3rem 0 1rem',
  },
  tab: (active: boolean) => ({
    padding: '0.75rem 1.15rem',
    borderRadius: 999,
    border: active ? '1px solid rgba(109,95,250,0.45)' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(109,95,250,0.14)' : 'rgba(255,255,255,0.03)',
    color: active ? '#E9D5FF' : '#94A3B8',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: 'pointer',
  }),
  myRankCard: {
    padding: '1.15rem 1.25rem',
    borderRadius: 22,
    border: '1px solid rgba(245,158,11,0.28)',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(236,65,251,0.08))',
    marginBottom: '1rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '1rem',
    boxShadow: '0 0 30px rgba(245,158,11,0.08)',
  },
  myRankLabel: {
    fontSize: '0.72rem',
    color: '#FCD34D',
    fontWeight: 800,
    letterSpacing: '0.08em',
    marginBottom: '0.35rem',
  },
  myRankValue: {
    fontSize: '1.1rem',
    fontWeight: 900,
    color: '#FFF7ED',
  },
  ctaBanner: {
    padding: '1rem 1.2rem',
    borderRadius: 20,
    border: '1px solid rgba(109,95,250,0.22)',
    background: 'rgba(17,20,40,0.72)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    marginBottom: '1rem',
  },
  ctaText: {
    color: '#CBD5E1',
    fontSize: '0.95rem',
  },
  ctaButton: {
    padding: '0.9rem 1.2rem',
    borderRadius: 999,
    border: 'none',
    background: PRIMARY_GRADIENT,
    color: '#FFFFFF',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '0.92rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 0 24px rgba(109,95,250,0.35)',
  },
  featuredPanel: {
    padding: '1.2rem',
    borderRadius: 28,
    marginBottom: '1rem',
  },
  sectionLabelWrap: {
    textAlign: 'center' as const,
    marginBottom: '1rem',
  },
  sectionLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.76rem',
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: '#A78BFA',
  },
  sectionLine: {
    width: 38,
    height: 1,
    background: 'rgba(109,95,250,0.35)',
  },
  topGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '1rem',
    alignItems: 'stretch',
  },
  topCard: (rank: number) => ({
    padding: '1.2rem 1rem',
    minHeight: rank === 1 ? 270 : 240,
    borderRadius: 26,
    border: `1px solid ${rank === 1 ? 'rgba(245,158,11,0.28)' : rank === 2 ? 'rgba(203,213,225,0.2)' : 'rgba(249,115,22,0.2)'}`,
    background: rank === 1
      ? 'linear-gradient(180deg, rgba(245,158,11,0.14), rgba(109,95,250,0.10), rgba(17,20,40,0.78))'
      : rank === 2
      ? 'linear-gradient(180deg, rgba(148,163,184,0.12), rgba(59,185,251,0.08), rgba(17,20,40,0.78))'
      : 'linear-gradient(180deg, rgba(249,115,22,0.12), rgba(236,65,251,0.08), rgba(17,20,40,0.78))',
    boxShadow: rank === 1 ? '0 0 34px rgba(245,158,11,0.08)' : '0 0 28px rgba(109,95,250,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    gap: '0.9rem',
  }),
  topRank: (rank: number) => ({
    fontSize: '0.85rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: RANK_COLORS[rank] || '#C4B5FD',
  }),
  avatar: (rank: number) => ({
    width: rank === 1 ? 76 : 68,
    height: rank === 1 ? 76 : 68,
    borderRadius: '50%',
    margin: '0 auto',
    border: `2px solid ${RANK_COLORS[rank] || '#8B5CF6'}`,
    background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(109,95,250,0.35) 35%, rgba(59,185,251,0.24) 65%, rgba(17,20,40,0.82) 100%)',
    boxShadow: '0 0 28px rgba(109,95,250,0.22)',
  }),
  topName: {
    textAlign: 'center' as const,
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#F8FAFC',
    wordBreak: 'break-word' as const,
  },
  topMeta: {
    textAlign: 'center' as const,
    fontSize: '0.84rem',
    color: '#94A3B8',
  },
  levelBadge: (level: number) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.42rem 0.75rem',
    borderRadius: 999,
    border: `1px solid ${LEVEL_COLORS[level] || '#8B5CF6'}55`,
    background: `${LEVEL_COLORS[level] || '#8B5CF6'}16`,
    color: LEVEL_COLORS[level] || '#8B5CF6',
    fontSize: '0.74rem',
    fontWeight: 800,
  }),
  topScore: {
    textAlign: 'center' as const,
    fontSize: '1.6rem',
    fontWeight: 900,
    color: '#F8FAFC',
  },
  topScoreLabel: {
    textAlign: 'center' as const,
    color: '#94A3B8',
    fontSize: '0.76rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  ladderList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.9rem',
  },
  ladderRow: (isCurrentUser: boolean, rank: number) => ({
    display: 'grid',
    gridTemplateColumns: '78px 58px minmax(0, 1.4fr) minmax(180px, 1fr) 132px 82px',
    gap: '0.85rem',
    alignItems: 'center',
    padding: '1rem 1.1rem',
    borderRadius: 22,
    border: isCurrentUser
      ? '1px solid rgba(245,158,11,0.28)'
      : '1px solid rgba(255,255,255,0.07)',
    background: isCurrentUser
      ? 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(109,95,250,0.08), rgba(17,20,40,0.72))'
      : 'rgba(17,20,40,0.72)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: rank <= 3 ? '0 0 24px rgba(109,95,250,0.08)' : '0 8px 32px rgba(0,0,0,0.32)',
  }),
  ladderRank: (rank: number) => ({
    fontSize: '1rem',
    fontWeight: 900,
    color: RANK_COLORS[rank] || '#C4B5FD',
  }),
  ladderAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '1px solid rgba(109,95,250,0.32)',
    background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), rgba(109,95,250,0.32) 40%, rgba(59,185,251,0.2) 65%, rgba(17,20,40,0.88) 100%)',
  },
  nameWrap: {
    minWidth: 0,
  },
  name: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#F8FAFC',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  nameMeta: {
    marginTop: '0.28rem',
    color: '#94A3B8',
    fontSize: '0.8rem',
  },
  scoreTrack: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
  },
  barBg: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden' as const,
    minWidth: 90,
  },
  barFill: (score: number) => ({
    height: '100%',
    width: `${Math.max(6, Math.min(100, score))}%`,
    background: score >= 85
      ? PRIMARY_GRADIENT
      : score >= 70
      ? 'linear-gradient(135deg, #3BB9FB 0%, #6D5FFA 100%)'
      : 'linear-gradient(135deg, #10B981 0%, #3BB9FB 100%)',
    borderRadius: 999,
  }),
  scoreNum: {
    minWidth: 38,
    textAlign: 'right' as const,
    color: '#F8FAFC',
    fontSize: '0.88rem',
    fontWeight: 800,
  },
  pecamMini: {
    display: 'flex',
    gap: 4,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  pecamBar: (val: number, index: number) => ({
    width: 8,
    height: Math.max(8, Math.round((val / 100) * 24)),
    background: index % 3 === 0
      ? 'linear-gradient(180deg, #6D5FFA, #EC41FB)'
      : index % 3 === 1
      ? 'linear-gradient(180deg, #3BB9FB, #6D5FFA)'
      : 'linear-gradient(180deg, #10B981, #3BB9FB)',
    opacity: 0.45 + val / 180,
    borderRadius: '4px 4px 0 0',
  }),
  loading: {
    textAlign: 'center' as const,
    color: '#E9D5FF',
    fontSize: '0.95rem',
    fontWeight: 700,
    padding: '4rem',
  },
  error: {
    textAlign: 'center' as const,
    color: '#FCA5A5',
    fontSize: '0.95rem',
    padding: '2rem',
  },
  empty: {
    textAlign: 'center' as const,
    color: '#CBD5E1',
    fontSize: '0.95rem',
    padding: '3rem',
  },
  pagination: {
    display: 'flex',
    gap: '0.6rem',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '1.2rem',
    flexWrap: 'wrap' as const,
  },
  pageBtn: (active: boolean) => ({
    padding: '0.7rem 0.95rem',
    border: active ? '1px solid rgba(109,95,250,0.45)' : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    background: active ? 'rgba(109,95,250,0.14)' : 'rgba(255,255,255,0.03)',
    color: active ? '#E9D5FF' : '#94A3B8',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  }),
  footer: {
    marginTop: '2rem',
    paddingTop: '1.4rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    color: '#64748B',
    fontSize: '0.82rem',
    textAlign: 'center' as const,
  },
}

function getPillarCombined(pillarScores: Record<string, number | Record<string, number>>): number[] {
  const pillars = ['P', 'E', 'C', 'A', 'M']
  return pillars.map((p) => {
    const v = pillarScores[p]
    if (typeof v === 'number') return v
    if (v && typeof v === 'object') return (v as Record<string, number>).combined ?? 0
    return 0
  })
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('alltime')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const token = sessionStorage.getItem('auth_token')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`

        const res = await fetch(
          `${API_BASE}/leaderboard/?period=${period}&page=${page}&page_size=50`,
          { headers },
        )
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || `HTTP ${res.status}`)
        }
        const json: LeaderboardResponse = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [period, page, token])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1
  const topThree = useMemo(() => (page === 1 ? (data?.entries ?? []).slice(0, 3) : []), [data, page])
  const ladderEntries = useMemo(() => {
    if (!data) return []
    return page === 1 ? data.entries.slice(3) : data.entries
  }, [data, page])

  return (
    <div style={styles.page}>
      <div style={styles.blob('-8%', '68%', 520, 'radial-gradient(circle, rgba(109,95,250,0.55) 0%, rgba(109,95,250,0) 70%)')} />
      <div style={styles.blob('48%', '-8%', 420, 'radial-gradient(circle, rgba(236,65,251,0.35) 0%, rgba(236,65,251,0) 70%)')} />
      <div style={styles.blob('62%', '22%', 360, 'radial-gradient(circle, rgba(59,185,251,0.28) 0%, rgba(59,185,251,0) 70%)')} />

      <div style={styles.container}>
        <div
          style={styles.backLink}
          onClick={() => navigate('/')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/')}
        >
          <span>←</span>
          <span>Back</span>
        </div>

        <div style={styles.hero}>
          <div style={{ ...styles.glassCard, ...styles.heroPanel }}>
            <div style={styles.heroTag}>
              <span style={styles.heroDot} />
              <span>Global Prompt Engineering Ladder</span>
            </div>
            <h1 style={styles.heading}>
              <span>Climb the </span>
              <span style={styles.gradientText}>Leaderboard.</span>
            </h1>
            <p style={styles.subtitle}>
              Full-assessment operators are ranked by real PromptRanks scores. Compare your level, track your
              PECAM spread, and push toward the top tiers.
            </p>

            <div style={styles.statRow}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{data?.total ?? '--'}</div>
                <div style={styles.statLabel}>Ranked operators</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{period.toUpperCase()}</div>
                <div style={styles.statLabel}>Leaderboard window</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>PECAM</div>
                <div style={styles.statLabel}>Score bars + pillar spread in every row</div>
              </div>
            </div>
          </div>

          <div style={{ ...styles.glassCard, ...styles.sidePanel }}>
            <div>
              <h2 style={styles.sideTitle}>How ranking works</h2>
              <p style={styles.sideCopy}>
                Only Full Assessment runs appear here. Sign in to see your personal rank callout when you qualify for the public ladder.
              </p>
            </div>
            <div style={styles.sideBadgeRow}>
              <span style={styles.sideBadge('purple')}>Premium leaderboard UI</span>
              <span style={styles.sideBadge('cyan')}>Live score data</span>
              <span style={styles.sideBadge('green')}>Badge-linked profiles</span>
            </div>
          </div>
        </div>

        <div style={styles.tabRow}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              style={styles.tab(period === p.value)}
              onClick={() => {
                setPeriod(p.value)
                setPage(1)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {data?.my_rank && (
          <div style={styles.myRankCard}>
            <div>
              <div style={styles.myRankLabel}>YOUR RANK</div>
              <div style={styles.myRankValue}>#{data.my_rank.rank}</div>
            </div>
            <div>
              <div style={styles.myRankLabel}>YOUR SCORE</div>
              <div style={styles.myRankValue}>{Math.round(data.my_rank.score)}</div>
            </div>
            <div>
              <div style={styles.myRankLabel}>STATUS</div>
              <div style={styles.myRankValue}>ON LADDER</div>
            </div>
          </div>
        )}

        {data && !data.my_rank && !token && (
          <div style={styles.ctaBanner}>
            <span style={styles.ctaText}>Take the Full Assessment to appear on the leaderboard.</span>
            <button style={styles.ctaButton} onClick={() => navigate('/')}>
              Start Assessment
            </button>
          </div>
        )}

        {loading && <div style={styles.loading}>Loading leaderboard…</div>}
        {error && !loading && <div style={styles.error}>{error}</div>}
        {!loading && !error && data && data.entries.length === 0 && (
          <div style={styles.empty}>No entries yet. Be the first to complete a Full Assessment.</div>
        )}

        {!loading && !error && data && data.entries.length > 0 && (
          <>
            {topThree.length > 0 && (
              <div style={{ ...styles.glassCard, ...styles.featuredPanel }}>
                <div style={styles.sectionLabelWrap}>
                  <div style={styles.sectionLabel}>
                    <span style={styles.sectionLine} />
                    <span>Featured Operators</span>
                    <span style={styles.sectionLine} />
                  </div>
                </div>

                <div style={styles.topGrid}>
                  {topThree.map((entry) => (
                    <div key={entry.user_id} style={styles.topCard(entry.rank)}>
                      <div style={styles.topRank(entry.rank)}>#{entry.rank}</div>
                      <div style={styles.avatar(entry.rank)} />
                      <div style={styles.topName}>{entry.display_name}</div>
                      <div style={styles.topMeta}>{entry.level_name}</div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <span style={styles.levelBadge(entry.level)}>
                          L{entry.level} {LEVEL_LABELS[entry.level] || ''}
                        </span>
                      </div>
                      <div>
                        <div style={styles.topScore}>{Math.round(entry.score)}</div>
                        <div style={styles.topScoreLabel}>Overall Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.ladderList}>
              {ladderEntries.map((entry) => {
                const isMe = token ? data.my_rank?.rank === entry.rank : false
                const pillarVals = getPillarCombined(entry.pillar_scores)

                return (
                  <div key={entry.user_id} style={styles.ladderRow(isMe, entry.rank)}>
                    <div style={styles.ladderRank(entry.rank)}>{entry.rank <= 3 ? `#0${entry.rank}` : `#${entry.rank}`}</div>
                    <div style={styles.ladderAvatar} />
                    <div style={styles.nameWrap}>
                      <div style={styles.name}>
                        {entry.display_name}
                        {isMe ? ' (you)' : ''}
                      </div>
                      <div style={styles.nameMeta}>{new Date(entry.achieved_at).toLocaleDateString()}</div>
                    </div>
                    <div style={styles.scoreTrack}>
                      <div style={styles.barBg}>
                        <div style={styles.barFill(entry.score)} />
                      </div>
                      <span style={styles.scoreNum}>{Math.round(entry.score)}</span>
                    </div>
                    <span style={styles.levelBadge(entry.level)}>
                      L{entry.level} {LEVEL_LABELS[entry.level] || ''}
                    </span>
                    <div style={styles.pecamMini}>
                      {pillarVals.map((v, i) => (
                        <div key={i} style={styles.pecamBar(v, i)} title={`${['P', 'E', 'C', 'A', 'M'][i]}: ${Math.round(v)}`} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button
              style={styles.pageBtn(false)}
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  style={styles.pageBtn(p === page)}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            })}
            <button
              style={styles.pageBtn(false)}
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        )}

        <div style={styles.footer}>Full Assessment scores only — PromptRanks PECAM Framework</div>
      </div>
    </div>
  )
}
