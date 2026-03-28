import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TAXONOMY_API_BASE = import.meta.env.VITE_BACKOFFICE_API_URL || 'http://localhost:8001'

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

interface TaxonomyOption {
  id: string
  name: string
  slug: string
  industry_id?: string | null
}

interface TopEntry {
  rank: number
  user_id: string
  display_name: string
  level: number
  level_name: string
  score: number
}

const PILLAR_ROWS = [
  [
    { letter: 'P', name: 'Prompt Design', desc: 'Crafting clear, high-leverage instructions' },
    { letter: 'E', name: 'Evaluation', desc: 'Judging output quality and failure modes' },
  ],
  [
    { letter: 'C', name: 'Context Management', desc: 'Managing memory, retrieval, and constraints' },
    { letter: 'M', name: 'Meta-Cognition', desc: 'Reasoning about model behavior and limits' },
    { letter: 'A', name: 'Agentic Prompting', desc: 'Designing multi-step workflows that compound' },
  ],
]

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #07091A 0%, #0E0B2E 40%, #0A0714 100%)',
    color: '#F1F5F9',
    fontFamily: 'Inter, system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  container: {
    maxWidth: 1120,
    width: '100%',
    padding: '3rem 1.25rem 4rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.9fr)',
    gap: '1.5rem',
    alignItems: 'stretch',
  },
  heroPanel: {
    padding: '2rem',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(17,20,40,0.72)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 999,
    border: '1px solid rgba(109,95,250,0.28)',
    color: '#C4B5FD',
    background: 'rgba(109,95,250,0.12)',
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: '1rem',
  },
  heading: {
    fontSize: 'clamp(2.6rem, 5vw, 4.25rem)',
    lineHeight: 1.02,
    color: '#F8FAFC',
    margin: '0 0 1rem',
    fontWeight: 900,
    letterSpacing: '-0.04em',
  },
  gradientText: {
    background: GRADIENT_TEXT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subheading: {
    fontSize: '1.08rem',
    color: '#94A3B8',
    lineHeight: 1.7,
    margin: '0 0 1.5rem',
    maxWidth: 620,
  },
  statRow: {
    display: 'flex',
    gap: '0.85rem',
    flexWrap: 'wrap' as const,
    marginBottom: '1.5rem',
  },
  statCard: {
    minWidth: 140,
    padding: '0.95rem 1rem',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#F8FAFC',
    marginBottom: '0.35rem',
    letterSpacing: '0.02em',
  },
  statLabel: {
    fontSize: '0.82rem',
    color: '#94A3B8',
    lineHeight: 1.5,
  },
  selectorPanel: {
    padding: '1.5rem',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(17,20,40,0.72)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  selectorTitle: {
    fontSize: '0.8rem',
    fontWeight: 800,
    color: '#C4B5FD',
    letterSpacing: '0.12em',
    margin: 0,
    textTransform: 'uppercase' as const,
  },
  selectorText: {
    margin: 0,
    color: '#CBD5E1',
    lineHeight: 1.65,
    fontSize: '0.95rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.45rem',
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  select: {
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(15,23,42,0.7)',
    color: '#F8FAFC',
    fontSize: '0.95rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    minWidth: 0,
  },
  hint: {
    fontSize: '0.8rem',
    color: '#94A3B8',
    minHeight: '1rem',
    lineHeight: 1.5,
  },
  buttonRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    marginTop: '0.25rem',
  },
  ctaButton: {
    padding: '14px 18px',
    borderRadius: 14,
    border: 'none',
    background: PRIMARY_GRADIENT,
    color: '#fff',
    fontSize: '0.95rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 16px 40px rgba(109,95,250,0.3)',
  },
  secondaryButton: {
    padding: '14px 18px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#E2E8F0',
    fontSize: '0.95rem',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 700,
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  heroFooter: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
    marginTop: '1rem',
  },
  heroTag: {
    padding: '0.45rem 0.8rem',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#CBD5E1',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  section: {
    marginTop: '1.5rem',
    padding: '1.75rem',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24,
    background: 'rgba(17,20,40,0.68)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
  },
  sectionTitle: {
    fontSize: '0.86rem',
    color: '#C4B5FD',
    margin: '0 0 0.8rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.16em',
    fontWeight: 800,
  },
  sectionCopy: {
    color: '#94A3B8',
    fontSize: '0.98rem',
    lineHeight: 1.7,
    margin: '0 0 1.4rem',
  },
  pillarRows: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  pillarRow: {
    display: 'grid',
    gap: '1rem',
  },
  pillarCard: {
    padding: '1.15rem',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    textAlign: 'left' as const,
    minHeight: 136,
  },
  pillarLetter: {
    fontSize: '1.5rem',
    fontWeight: 900,
    color: '#F8FAFC',
    marginBottom: '0.8rem',
    letterSpacing: '-0.04em',
  },
  pillarName: {
    fontSize: '1rem',
    color: '#F8FAFC',
    marginBottom: '0.45rem',
    fontWeight: 700,
  },
  pillarDesc: {
    fontSize: '0.88rem',
    color: '#94A3B8',
    lineHeight: 1.6,
  },
  stepsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  step: {
    textAlign: 'left' as const,
    padding: '1.35rem',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
  },
  stepNumber: {
    fontSize: '1.4rem',
    fontWeight: 900,
    color: '#A78BFA',
    marginBottom: '0.8rem',
    letterSpacing: '-0.03em',
  },
  stepLabel: {
    fontSize: '0.82rem',
    fontWeight: 800,
    color: '#F8FAFC',
    marginBottom: '0.75rem',
    lineHeight: 1.6,
    letterSpacing: '0.1em',
  },
  stepCopy: {
    fontSize: '0.98rem',
    color: '#94A3B8',
    lineHeight: 1.7,
  },
  ladderIntro: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    marginBottom: '1rem',
  },
  ladderGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
    gap: '1rem',
  },
  podiumPanel: {
    padding: '1.2rem',
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(17,20,40,0.78), rgba(12,15,30,0.78))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  podiumGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.85rem',
    alignItems: 'end',
  },
  podiumCard: (rank: number) => ({
    padding: '1.1rem 0.85rem',
    borderRadius: 20,
    border: `1px solid ${rank === 1 ? 'rgba(245,158,11,0.4)' : rank === 2 ? 'rgba(203,213,225,0.25)' : rank === 3 ? 'rgba(249,115,22,0.26)' : 'rgba(255,255,255,0.08)'}`,
    background: rank === 1
      ? 'linear-gradient(180deg, rgba(245,158,11,0.2), rgba(109,95,250,0.08))'
      : rank === 2
      ? 'linear-gradient(180deg, rgba(203,213,225,0.15), rgba(59,185,251,0.06))'
      : 'linear-gradient(180deg, rgba(249,115,22,0.16), rgba(236,65,251,0.07))',
    minHeight: rank === 1 ? 232 : rank === 2 ? 198 : 182,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-end',
    gap: '0.6rem',
    textAlign: 'center' as const,
    boxShadow: rank === 1 ? '0 18px 40px rgba(245,158,11,0.12)' : 'none',
  }),
  podiumRank: (rank: number) => ({
    fontSize: '0.8rem',
    fontWeight: 800,
    color: RANK_COLORS[rank] || '#A78BFA',
    letterSpacing: '0.08em',
  }),
  podiumAvatar: (rank: number) => ({
    width: 58,
    height: 58,
    borderRadius: '50%',
    margin: '0 auto 0.35rem',
    border: `2px solid ${RANK_COLORS[rank] || '#A78BFA'}`,
    background: rank === 1
      ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(245,158,11,0.35) 40%, rgba(109,95,250,0.4) 75%, rgba(17,20,40,0.9))'
      : rank === 2
      ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.48), rgba(203,213,225,0.3) 40%, rgba(59,185,251,0.28) 75%, rgba(17,20,40,0.9))'
      : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.45), rgba(249,115,22,0.3) 40%, rgba(236,65,251,0.28) 75%, rgba(17,20,40,0.9))',
    boxShadow: '0 10px 26px rgba(0,0,0,0.3)',
  }),
  podiumName: {
    color: '#F8FAFC',
    fontSize: '0.96rem',
    fontWeight: 700,
    wordBreak: 'break-word' as const,
  },
  podiumScore: {
    fontSize: '1.05rem',
    fontWeight: 900,
    color: '#F8FAFC',
    letterSpacing: '-0.03em',
  },
  miniLevel: (level: number) => ({
    display: 'inline-block',
    margin: '0 auto',
    padding: '0.32rem 0.6rem',
    borderRadius: 999,
    border: `1px solid ${LEVEL_COLORS[level] || '#8B5CF6'}33`,
    color: LEVEL_COLORS[level] || '#8B5CF6',
    fontSize: '0.7rem',
    fontWeight: 800,
    background: `${LEVEL_COLORS[level] || '#8B5CF6'}14`,
    letterSpacing: '0.05em',
  }),
  queuePanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  queueCard: {
    display: 'grid',
    gridTemplateColumns: '56px 1fr auto auto',
    gap: '0.75rem',
    alignItems: 'center',
    padding: '0.95rem 1rem',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
  },
  queueRank: {
    fontSize: '0.8rem',
    fontWeight: 800,
    color: '#A78BFA',
    letterSpacing: '0.08em',
  },
  queueNameWrap: {
    minWidth: 0,
  },
  queueName: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#F8FAFC',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  queueMeta: {
    fontSize: '0.78rem',
    color: '#94A3B8',
    marginTop: '0.2rem',
  },
  scorePill: {
    fontSize: '0.78rem',
    fontWeight: 800,
    color: '#F8FAFC',
    minWidth: 42,
    textAlign: 'right' as const,
  },
  footerButtonWrap: {
    textAlign: 'center' as const,
    marginTop: '1.25rem',
  },
  footer: {
    marginTop: '2.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    fontSize: '0.84rem',
    color: '#64748B',
    textAlign: 'center' as const,
  },
  error: {
    color: '#FCA5A5',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
}

export default function Landing() {
  const navigate = useNavigate()
  const [industryId, setIndustryId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topEntries, setTopEntries] = useState<TopEntry[]>([])
  const [industries, setIndustries] = useState<TaxonomyOption[]>([])
  const [roles, setRoles] = useState<TaxonomyOption[]>([])
  const [taxonomyLoading, setTaxonomyLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(false)
  const [taxonomyError, setTaxonomyError] = useState('')

  const selectedIndustry = useMemo(
    () => industries.find((entry) => entry.id === industryId) ?? null,
    [industries, industryId],
  )

  const selectedRole = useMemo(
    () => roles.find((entry) => entry.id === roleId) ?? null,
    [roles, roleId],
  )

  useEffect(() => {
    fetch(`${API_BASE}/leaderboard/?period=alltime&page=1&page_size=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.entries) setTopEntries(d.entries)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const fetchIndustries = async () => {
      setTaxonomyLoading(true)
      setTaxonomyError('')
      try {
        const res = await fetch(`${TAXONOMY_API_BASE}/industries`)
        if (!res.ok) throw new Error('Failed to load industries')
        const data: TaxonomyOption[] = await res.json()
        setIndustries(data)
      } catch {
        setIndustries([])
        setTaxonomyError('Industry and role taxonomy is temporarily unavailable.')
      } finally {
        setTaxonomyLoading(false)
      }
    }

    fetchIndustries()
  }, [])

  useEffect(() => {
    const fetchRoles = async () => {
      setRoleLoading(true)
      setTaxonomyError('')
      try {
        const qs = industryId ? `?industry_id=${encodeURIComponent(industryId)}` : ''
        const res = await fetch(`${TAXONOMY_API_BASE}/roles${qs}`)
        if (!res.ok) throw new Error('Failed to load roles')
        const data: TaxonomyOption[] = await res.json()
        setRoles(data)
        setRoleId((current) => (data.some((entry) => entry.id === current) ? current : ''))
      } catch {
        setRoles([])
        setRoleId('')
        setTaxonomyError('Role taxonomy could not be loaded right now.')
      } finally {
        setRoleLoading(false)
      }
    }

    fetchRoles()
  }, [industryId])

  const startAssessment = async (mode: 'quick' | 'full') => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/assessments/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          industry: selectedIndustry?.name || null,
          role: selectedRole?.name || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to start assessment')
      }

      const data = await res.json()
      sessionStorage.setItem('assessment', JSON.stringify(data))
      navigate(`/assessment/${data.assessment_id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start assessment'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const podiumEntries = topEntries.slice(0, 3)
  const ladderEntries = topEntries.slice(3)

  return (
    <div style={styles.page}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            left: '62%',
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236,65,251,0.28) 0%, rgba(236,65,251,0) 72%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '14%',
            left: '-8%',
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(109,95,250,0.36) 0%, rgba(109,95,250,0) 72%)',
            filter: 'blur(82px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '38%',
            left: '58%',
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,185,251,0.22) 0%, rgba(59,185,251,0) 72%)',
            filter: 'blur(76px)',
          }}
        />
      </div>

      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.heroPanel}>
            <div style={styles.eyebrow}>LIVE PECAM PROMPT SKILL RANKING</div>
            <h1 style={styles.heading}>
              PromptRanks, with a
              <span style={styles.gradientText}> live competitive ladder.</span>
            </h1>
            <p style={styles.subheading}>
              Benchmark your prompting skill against a real leaderboard. Take a rapid skills check or go full-length,
              earn a verifiable badge, and see where you place.
            </p>

            <div style={styles.statRow}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>15 MIN</div>
                <div style={styles.statLabel}>Quick signal check</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>5 PILLARS</div>
                <div style={styles.statLabel}>Prompt, Eval, Context, Meta, Agentic</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>LIVE RANK</div>
                <div style={styles.statLabel}>Competitive leaderboard for full assessments</div>
              </div>
            </div>

            <div style={styles.heroFooter}>
              <span style={styles.heroTag}>Verifiable badge</span>
              <span style={styles.heroTag}>Open scoring framework</span>
              <span style={styles.heroTag}>Full assessments unlock ranking</span>
            </div>
          </div>

          <div style={styles.selectorPanel}>
            <h2 style={styles.selectorTitle}>ENTER THE LADDER</h2>
            <p style={styles.selectorText}>
              Personalize your run with your current industry and role. These selectors are loaded from the live taxonomy.
            </p>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel} htmlFor="industry-select">INDUSTRY</label>
              <select
                id="industry-select"
                style={styles.select}
                value={industryId}
                onChange={(e) => setIndustryId(e.target.value)}
                disabled={taxonomyLoading}
              >
                <option value="">Industry (optional)</option>
                {industries.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel} htmlFor="role-select">ROLE</label>
              <select
                id="role-select"
                style={styles.select}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={taxonomyLoading || roleLoading}
              >
                <option value="">Role (optional)</option>
                {roles.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.hint}>
              {taxonomyLoading
                ? 'Loading taxonomy…'
                : roleLoading
                ? 'Refreshing roles…'
                : taxonomyError || 'Choose a role directly, or filter roles by selecting an industry first.'}
            </div>

            <div style={styles.buttonRow}>
              <button
                style={{
                  ...styles.ctaButton,
                  ...(loading ? styles.disabledButton : {}),
                }}
                onClick={() => startAssessment('quick')}
                disabled={loading}
              >
                {loading ? '[ INITIALIZING... ]' : 'Quick Assessment (15 min)'}
              </button>
              <button
                style={{
                  ...styles.secondaryButton,
                  ...(loading ? styles.disabledButton : {}),
                }}
                onClick={() => startAssessment('full')}
                disabled={loading}
              >
                {loading ? '[ INITIALIZING... ]' : 'Full Assessment (~60 min)'}
              </button>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>THE PECAM FRAMEWORK</h2>
          <p style={styles.sectionCopy}>
            PromptRanks scores across five practical dimensions of AI prompting skill. The ladder rewards breadth,
            not just one-off prompt tricks.
          </p>
          <div style={styles.pillarRows}>
            {PILLAR_ROWS.map((row, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  ...styles.pillarRow,
                  gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                }}
              >
                {row.map((pillar) => (
                  <div key={pillar.letter} style={styles.pillarCard}>
                    <div style={styles.pillarLetter}>{pillar.letter}</div>
                    <div style={styles.pillarName}>{pillar.name}</div>
                    <div style={styles.pillarDesc}>{pillar.desc}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>HOW IT WORKS</h2>
          <p style={styles.sectionCopy}>
            Run through a structured prompt assessment, get scored against the framework, then turn that score into a public proof of skill.
          </p>
          <div style={styles.stepsRow}>
            <div style={styles.step}>
              <div style={styles.stepNumber}>01</div>
              <div style={styles.stepLabel}>ASSESS</div>
              <div style={styles.stepCopy}>
                Answer knowledge questions and complete realistic prompting tasks that reflect day-to-day AI work.
              </div>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNumber}>02</div>
              <div style={styles.stepLabel}>SCORE</div>
              <div style={styles.stepCopy}>
                Your performance is evaluated across PECAM so strengths and weak spots show up clearly.
              </div>
            </div>
            <div style={styles.step}>
              <div style={styles.stepNumber}>03</div>
              <div style={styles.stepLabel}>RANK + SHARE</div>
              <div style={styles.stepCopy}>
                Full assessments place you on the ladder and unlock a badge you can verify and share publicly.
              </div>
            </div>
          </div>
        </div>

        <div id="leaderboard" style={styles.section}>
          <div style={styles.ladderIntro}>
            <div>
              <h2 style={styles.sectionTitle}>Top Prompt Engineers</h2>
              <p style={{ ...styles.sectionCopy, marginBottom: 0 }}>
                The public leaderboard updates from full assessment results. Climb high enough and your rank becomes part of your profile.
              </p>
            </div>
            <button style={styles.secondaryButton} onClick={() => navigate('/leaderboard')}>
              View Full Leaderboard
            </button>
          </div>

          {topEntries.length === 0 ? (
            <p style={styles.pillarDesc}>No entries yet. Complete a Full Assessment to become the first ranked operator.</p>
          ) : (
            <div style={styles.ladderGrid}>
              <div style={styles.podiumPanel}>
                <div style={styles.podiumGrid}>
                  {podiumEntries.map((entry) => (
                    <div key={entry.user_id ?? entry.rank} style={styles.podiumCard(entry.rank)}>
                      <div style={styles.podiumRank(entry.rank)}>#{entry.rank}</div>
                      <div style={styles.podiumAvatar(entry.rank)} />
                      <div style={styles.podiumName}>{entry.display_name}</div>
                      <div style={{ color: '#94A3B8', fontSize: '0.78rem' }}>{entry.level_name}</div>
                      <span style={styles.miniLevel(entry.level)}>L{entry.level}</span>
                      <div style={styles.podiumScore}>{Math.round(entry.score)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.queuePanel}>
                {ladderEntries.map((entry) => (
                  <div key={entry.user_id ?? entry.rank} style={styles.queueCard}>
                    <div style={styles.queueRank}>#{entry.rank}</div>
                    <div style={styles.queueNameWrap}>
                      <div style={styles.queueName}>{entry.display_name}</div>
                      <div style={styles.queueMeta}>{entry.level_name} · L{entry.level}</div>
                    </div>
                    <span style={styles.miniLevel(entry.level)}>LVL {entry.level}</span>
                    <div style={styles.scorePill}>{Math.round(entry.score)}</div>
                  </div>
                ))}
                <div style={styles.footerButtonWrap}>
                  <button style={styles.ctaButton} onClick={() => navigate('/leaderboard')}>
                    See the Full Leaderboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          Powered by the PECAM Framework &mdash; Open Source (MIT + CC-BY-SA 4.0)
        </div>
      </div>
    </div>
  )
}
