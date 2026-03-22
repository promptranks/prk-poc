import { useState, useRef, useCallback } from 'react'

interface PromptEditorProps {
  onExecute: (prompt: string) => Promise<void>
  disabled?: boolean
  executing?: boolean
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    height: '100%',
  },
  label: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.6rem',
    color: '#008f11',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
  },
  editorContainer: {
    position: 'relative' as const,
    flex: 1,
    minHeight: 200,
    display: 'flex',
    border: '1px solid rgba(0,255,65,0.2)',
    borderRadius: 4,
    background: 'rgba(0,5,0,0.8)',
    overflow: 'hidden' as const,
  },
  lineNumbers: {
    width: 40,
    padding: '12px 8px',
    background: 'rgba(0,10,0,0.6)',
    borderRight: '1px solid rgba(0,255,65,0.1)',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.85rem',
    lineHeight: '1.5',
    color: '#008f11',
    textAlign: 'right' as const,
    userSelect: 'none' as const,
    overflow: 'hidden' as const,
  },
  textarea: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#00ff41',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.85rem',
    lineHeight: '1.5',
    resize: 'none' as const,
    width: '100%',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: '0.75rem',
    color: '#008f11',
    fontFamily: "'Share Tech Mono', monospace",
  },
  executeButton: {
    padding: '12px 28px',
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
}

export default function PromptEditor({ onExecute, disabled = false, executing = false }: PromptEditorProps) {
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const lineCount = Math.max(prompt.split('\n').length, 10)
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const handleExecute = useCallback(async () => {
    if (!prompt.trim() || disabled || executing) return
    await onExecute(prompt)
  }, [prompt, disabled, executing, onExecute])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleExecute()
    }
  }, [handleExecute])

  return (
    <div style={styles.wrapper}>
      <div style={styles.label}>Your Prompt</div>
      <div style={styles.editorContainer}>
        <div ref={lineNumbersRef} style={styles.lineNumbers}>
          {lineNumbers}
        </div>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder="Write your prompt here..."
          disabled={disabled || executing}
          spellCheck={false}
        />
      </div>
      <div style={styles.footer}>
        <span style={styles.charCount}>{prompt.length} chars</span>
        <button
          style={{
            ...styles.executeButton,
            ...(!prompt.trim() || disabled || executing ? styles.disabled : {}),
          }}
          onClick={handleExecute}
          disabled={!prompt.trim() || disabled || executing}
        >
          {executing ? '[ EXECUTING... ]' : '[ EXECUTE ] (Ctrl+Enter)'}
        </button>
      </div>
    </div>
  )
}
