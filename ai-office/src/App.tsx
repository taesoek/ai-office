import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

// ─── 타입 ────────────────────────────────────────────────────────────
type Msg = { role: 'user' | 'assistant'; content: string }
type AgentState = { history: Msg[]; input: string; loading: boolean }
type Agent = { id: string; name: string; emoji: string; color: string; bg: string; specialty: string; task?: string }
type TaskStatus = 'pending' | 'working' | 'done'
type TaskLog = { name: string; task: string; status: TaskStatus }
type GenStatus = { stage: string; message: string } | null

// ─── 상수 ────────────────────────────────────────────────────────────
const PM: Agent = { id: 'pm', name: '지나', emoji: '👩‍💼', color: '#c084fc', bg: '#2d1f5e', specialty: '프로젝트 매니저' }

const MAP_OBJECTS = [
  { label: '🖥️ 기획실',       left: 20,  top: 16,  w: 120, h: 48, bg: '#1a1f35', bc: '#2d3a6a' },
  { label: '🎨 크리에이티브', left: 180, top: 16,  w: 120, h: 48, bg: '#1f1535', bc: '#5a2d8e' },
  { label: '💻 개발팀',        left: 340, top: 16,  w: 110, h: 48, bg: '#0f2a1a', bc: '#1a6a3a' },
  { label: '📋 회의실',        left: 340, top: 110, w: 110, h: 70, bg: '#2a1515', bc: '#8e2d2d' },
  { label: '☕ 휴게실',        left: 20,  top: 120, w: 80,  h: 50, bg: '#1a1a10', bc: '#6a6a1a' },
]

const CHAR_SLOTS = [
  { left: 50,  top: 72  }, { left: 160, top: 72  }, { left: 270, top: 72  }, { left: 380, top: 72  },
  { left: 50,  top: 160 }, { left: 160, top: 160 }, { left: 270, top: 160 }, { left: 380, top: 160 },
]
const PM_POS = { left: 470, top: 110 }

// ─── 유틸 ────────────────────────────────────────────────────────────
function extractCode(text: string) {
  const patterns = [
    { regex: /```html\n?([\s\S]*?)```/,       ext: 'html',  lang: 'HTML' },
    { regex: /```tsx\n?([\s\S]*?)```/,         ext: 'tsx',   lang: 'TSX' },
    { regex: /```typescript\n?([\s\S]*?)```/,  ext: 'ts',    lang: 'TypeScript' },
    { regex: /```javascript\n?([\s\S]*?)```/,  ext: 'js',    lang: 'JavaScript' },
    { regex: /```jsx\n?([\s\S]*?)```/,         ext: 'jsx',   lang: 'JSX' },
    { regex: /```python\n?([\s\S]*?)```/,      ext: 'py',    lang: 'Python' },
    { regex: /```css\n?([\s\S]*?)```/,         ext: 'css',   lang: 'CSS' },
    { regex: /```[\w]*\n?([\s\S]*?)```/,       ext: 'txt',   lang: 'Code' },
  ]
  for (const p of patterns) { const m = text.match(p.regex); if (m) return { code: m[1].trim(), ext: p.ext, lang: p.lang } }
  return null
}

const LANG_MAP: Record<string, string> = { tsx:'TSX', typescript:'TypeScript', javascript:'JavaScript', jsx:'JSX', python:'Python', css:'CSS', html:'HTML', '':'Code' }
const EXT_MAP:  Record<string, string> = { tsx:'tsx', typescript:'ts', javascript:'js', jsx:'jsx', python:'py', css:'css', html:'html', '':'txt' }

// ─── CodeBlock ───────────────────────────────────────────────────────
function CodeBlock({ code, lang, ext }: { code: string; lang: string; ext: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const save = () => (window as any).electronAPI.saveFile(code, `output.${ext}`)
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{lang}</span>
        <div style={{ display:'flex', gap:6 }}>
          <button className="code-copy-btn" onClick={copy}>{copied ? '✓ 복사됨' : '📋 복사'}</button>
          <button className="code-copy-btn" onClick={save}>💾 저장</button>
        </div>
      </div>
      <pre className="code-content"><code>{code}</code></pre>
    </div>
  )
}

// ─── QuickCopyBar ─────────────────────────────────────────────────────
function QuickCopyBar({ content }: { content: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const blocks: { code: string; lang: string }[] = []
  const regex = /```([\w]*)\n?([\s\S]*?)```/g; let m
  while ((m = regex.exec(content)) !== null) blocks.push({ code: m[2].trim(), lang: LANG_MAP[m[1]] || m[1].toUpperCase() || 'Code' })
  if (!blocks.length) return null
  const copy = (code: string, i: number) => { navigator.clipboard.writeText(code); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000) }
  return (
    <div className="quick-copy-bar">
      <span className="quick-copy-label">📋 빠른 복사</span>
      <div className="quick-copy-btns">
        {blocks.map((b, i) => (
          <button key={i} className="quick-copy-btn" onClick={() => copy(b.code, i)}>
            {copiedIdx === i ? '✓!' : `${i+1}. ${b.lang}`}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── MessageRenderer ──────────────────────────────────────────────────
function MessageRenderer({ content, agentId }: { content: string; agentId: string }) {
  if (agentId === 'designer') {
    const htmlMatch = content.match(/```html\n?([\s\S]*?)```/)
    if (htmlMatch) {
      const before = content.substring(0, content.indexOf('```html')).trim()
      const fullMatch = content.match(/```html[\s\S]*?```/)
      const after = fullMatch ? content.substring(content.indexOf('```html') + fullMatch[0].length).trim() : ''
      return (
        <div>
          {before && <div style={{ whiteSpace:'pre-wrap', marginBottom:10 }}>{before}</div>}
          <div className="preview-container">
            <div className="preview-label"><span>🎨 UI 목업 미리보기</span></div>
            <iframe className="html-preview" srcDoc={htmlMatch[1]} sandbox="allow-scripts" title="UI Preview" />
          </div>
          {after && <div style={{ whiteSpace:'pre-wrap', marginTop:10 }}>{after}</div>}
        </div>
      )
    }
    const textOnly = content.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*/g, '').trim()
    return (
      <div>
        {textOnly && <div style={{ whiteSpace:'pre-wrap' }}>{textOnly}</div>}
        {content.includes('```') && <div className="generating-badge">🎨 목업 생성 중...</div>}
      </div>
    )
  }
  const parts: React.ReactNode[] = []
  let lastIndex = 0, idx = 0
  const reg = /```([\w]*)\n?([\s\S]*?)```/g; let match
  while ((match = reg.exec(content)) !== null) {
    if (match.index > lastIndex) { const t = content.substring(lastIndex, match.index).trim(); if (t) parts.push(<div key={idx++} style={{ whiteSpace:'pre-wrap', marginBottom:8 }}>{t}</div>) }
    parts.push(<CodeBlock key={idx++} code={match[2].trim()} lang={LANG_MAP[match[1]] || match[1].toUpperCase() || 'Code'} ext={EXT_MAP[match[1]] || 'txt'} />)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) { const t = content.substring(lastIndex).trim(); if (t) parts.push(<div key={idx++} style={{ whiteSpace:'pre-wrap', marginTop:8 }}>{t}</div>) }
  return parts.length === 0 ? <div style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{content}</div> : <div>{parts}</div>
}

// ─── FullScreenPreview ────────────────────────────────────────────────
function FullScreenPreview({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <div className="fullscreen-modal" onClick={e => e.stopPropagation()}>
        <div className="fullscreen-header">
          <span>🎨 UI 전체화면 미리보기</span>
          <button className="fullscreen-close" onClick={onClose}>✕ 닫기</button>
        </div>
        <iframe className="fullscreen-iframe" srcDoc={html} sandbox="allow-scripts" title="Full Preview" />
      </div>
    </div>
  )
}

// ─── ProjectGenModal ──────────────────────────────────────────────────
function ProjectGenModal({ status, result, onClose }: {
  status: GenStatus
  result: any
  onClose: () => void
}) {
  if (!status && !result) return null
  return (
    <div className="fullscreen-overlay" onClick={result ? onClose : undefined}>
      <div className="gen-modal" onClick={e => e.stopPropagation()}>
        {!result ? (
          <>
            <div className="gen-modal-title">🔨 프로젝트 생성 중...</div>
            <div className="gen-modal-stage">{status?.stage === 'planning' ? '📐 설계' : '📁 파일 생성'}</div>
            <div className="gen-modal-msg">{status?.message}</div>
            <div className="gen-spinner" />
          </>
        ) : result.ok ? (
          <>
            <div className="gen-modal-title">🎉 프로젝트 생성 완료!</div>
            <div className="gen-result-info">
              <div className="gen-info-row"><span>📁 폴더</span><code>{result.projectDir}</code></div>
              <div className="gen-info-row"><span>🛠 기술스택</span><span>{result.techStack}</span></div>
              <div className="gen-info-row"><span>📄 파일 수</span><span>{result.fileCount}개 생성됨</span></div>
            </div>
            <div className="gen-run-title">▶ 실행 방법</div>
            <div className="gen-run-steps">
              {result.runInstructions?.map((step: string, i: number) => (
                <div key={i} className="gen-run-step">
                  <span className="gen-step-num">{i + 1}</span>
                  <code>{step}</code>
                  <button className="gen-copy-btn" onClick={() => navigator.clipboard.writeText(step)}>복사</button>
                </div>
              ))}
            </div>
            <div className="gen-note">📂 탐색기가 자동으로 열렸습니다</div>
            <button className="dialog-btn" style={{ marginTop:12, alignSelf:'flex-end' }} onClick={onClose}>확인</button>
          </>
        ) : (
          <>
            <div className="gen-modal-title">❌ 생성 실패</div>
            <div style={{ color:'#f87171', fontSize:12, marginTop:8 }}>{result.error}</div>
            <button className="dialog-btn" style={{ marginTop:16 }} onClick={onClose}>닫기</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── AgentNameEditor (인라인 이름 편집) ──────────────────────────────
function AgentNameEditor({ agent, onRename }: { agent: Agent; onRename: (oldName: string, newName: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(agent.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const confirm = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== agent.name) onRename(agent.name, trimmed)
    else setValue(agent.name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="agent-name-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={confirm}
        onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setValue(agent.name); setEditing(false) } }}
        onClick={e => e.stopPropagation()}
      />
    )
  }
  return (
    <div className="agent-name" title="클릭하여 이름 변경" onClick={e => { e.stopPropagation(); setEditing(true) }}>
      {agent.name} <span className="name-edit-icon">✏️</span>
    </div>
  )
}

// ─── 메인 앱 ─────────────────────────────────────────────────────────
export default function App() {
  const [activeAgent, setActiveAgent] = useState<Agent>(PM)
  const [agents, setAgents] = useState<Agent[]>([])
  const [states, setStates] = useState<Record<string, AgentState>>({
    [PM.name]: {
      history: [{ role:'assistant', content:'안녕하세요, CEO님! 저는 PM 지나입니다. 🙋‍♀️\n\n어떤 프로젝트를 시작할까요? 업무를 말씀해 주시면 최적의 팀을 구성하고 바로 업무를 배분해 드릴게요!' }],
      input: '', loading: false
    }
  })
  const [projectNote, setProjectNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [fullScreenHtml, setFullScreenHtml] = useState<string | null>(null)
  const [dialogHeight, setDialogHeight] = useState(280)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([])
  const [projectTitle, setProjectTitle] = useState('')
  const [genStatus, setGenStatus] = useState<GenStatus>(null)
  const [genResult, setGenResult] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)

  const st = states[activeAgent.name]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [st?.history, st?.loading])

  // ── 에이전트 이름 변경 ──────────────────────────────────────────────
  const handleRename = useCallback((oldName: string, newName: string) => {
    // agent 리스트 업데이트
    setAgents(prev => prev.map(a => a.name === oldName ? { ...a, name: newName } : a))
    // states 키 이전
    setStates(prev => {
      const next = { ...prev }
      if (next[oldName]) { next[newName] = next[oldName]; delete next[oldName] }
      return next
    })
    // 현재 선택된 에이전트가 변경 대상이면 업데이트
    setActiveAgent(prev => prev.name === oldName ? { ...prev, name: newName } : prev)
    // taskLogs 업데이트
    setTaskLogs(prev => prev.map(t => t.name === oldName ? { ...t, name: newName } : t))
  }, [])

  // ── CEO → PM 프로젝트 요청 ──────────────────────────────────────────
  const requestProject = async () => {
    const pmState = states[PM.name]
    if (!pmState?.input.trim() || isCreatingTeam) return
    const text = pmState.input.trim()

    setStates(prev => ({
      ...prev,
      [PM.name]: {
        ...prev[PM.name],
        history: [...prev[PM.name].history, { role:'user', content:text }, { role:'assistant', content:'' }],
        input: '', loading: true
      }
    }))
    setIsCreatingTeam(true)
    setTaskLogs([])

    const api = (window as any).electronAPI
    api.offPmBriefing(); api.offAgentsCreated(); api.offAgentStreamTask(); api.offAgentTask()

    api.onPmBriefing((briefing: string) => {
      setStates(prev => {
        const h = [...prev[PM.name].history]
        h[h.length - 1] = { role:'assistant', content:briefing }
        return { ...prev, [PM.name]: { ...prev[PM.name], history:h } }
      })
    })

    api.onAgentsCreated((newAgents: Agent[], title: string) => {
      setProjectTitle(title)
      setAgents(newAgents)
      setTaskLogs(newAgents.map(a => ({ name:a.name, task:a.task||'', status:'pending' as TaskStatus })))
      newAgents.forEach(a => {
        setStates(prev => ({
          ...prev,
          [a.name]: {
            history: [{ role:'assistant', content:`안녕하세요! ${a.specialty} ${a.name}입니다. PM 지나로부터 태스크를 받았어요. 바로 시작할게요! 💪` }],
            input: '', loading: false
          }
        }))
      })
    })

    api.onAgentStreamTask((name: string, chunk: string) => {
      setStates(prev => {
        const s = prev[name]; if (!s) return prev
        const h = [...s.history]
        const last = h[h.length - 1]
        if (last?.role === 'assistant') h[h.length - 1] = { ...last, content: last.content + chunk }
        else h.push({ role:'assistant', content:chunk })
        return { ...prev, [name]: { ...s, history:h } }
      })
    })

    api.onAgentTaskStart((name: string, task: string) => {
      setTaskLogs(prev => prev.map(d => d.name === name ? { ...d, status:'working' as TaskStatus } : d))
      setStates(prev => {
        const s = prev[name]; if (!s) return prev
        return { ...prev, [name]: { ...s, history:[...s.history, { role:'user', content:`[PM 배정 태스크] ${task}` }, { role:'assistant', content:'' }], loading:true } }
      })
    })

    api.onAgentTaskDone((name: string) => {
      setTaskLogs(prev => prev.map(d => d.name === name ? { ...d, status:'done' as TaskStatus } : d))
      setStates(prev => { const s = prev[name]; if (!s) return prev; return { ...prev, [name]: { ...s, loading:false } } })
    })

    const result = await api.pmCreateTeam(PM.name, text, projectNote)
    api.offPmBriefing(); api.offAgentsCreated(); api.offAgentStreamTask(); api.offAgentTask()

    if (!result.ok) {
      setStates(prev => { const h = [...prev[PM.name].history]; h[h.length-1] = { role:'assistant', content:`❌ 오류: ${result.error}` }; return { ...prev, [PM.name]: { ...prev[PM.name], history:h, loading:false } } })
    } else {
      if (result.plan) {
        setProjectNote(prev => {
          const entry = `[프로젝트: ${result.plan.projectTitle}]\n${result.plan.pmBriefing}`
          return prev ? `${prev}\n\n${entry}` : entry
        })
      }
      setStates(prev => ({ ...prev, [PM.name]: { ...prev[PM.name], loading:false } }))
    }
    setIsCreatingTeam(false)
  }

  // ── 일반 채팅 ────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!st?.input.trim() || st.loading) return
    const text = st.input.trim()
    const agentName = activeAgent.name
    const newHistory: Msg[] = [...st.history, { role:'user', content:text }]

    setStates(prev => ({ ...prev, [agentName]: { ...prev[agentName], history:[...newHistory, { role:'assistant', content:'' }], input:'', loading:true } }))

    const api = (window as any).electronAPI
    api.offStream()
    api.onStream((chunk: string) => {
      setStates(prev => {
        const s = prev[agentName]; if (!s) return prev
        const h = [...s.history]; const last = h[h.length-1]
        if (last?.role === 'assistant') h[h.length-1] = { ...last, content: last.content + chunk }
        return { ...prev, [agentName]: { ...s, history:h } }
      })
    })

    let result
    if (activeAgent.id === 'pm') {
      const summary = agents.map(a => `${a.name} (${a.specialty})`).join(', ')
      result = await api.askPm(PM.name, newHistory, projectNote, summary)
    } else {
      result = await api.askAgent(activeAgent.id, activeAgent.name, activeAgent.specialty, newHistory, projectNote)
    }
    api.offStream()

    if (result.ok && result.text) {
      const codeResult = extractCode(result.text)
      if (codeResult && ['designer','frontend','backend'].includes(activeAgent.id)) {
        setProjectNote(prev => { const e = `\n\n[${activeAgent.name} 결과물 .${codeResult.ext}]\n${codeResult.code}`; return prev ? prev+e : e })
      }
    }
    setStates(prev => ({ ...prev, [agentName]: { ...prev[agentName], loading:false } }))
  }

  // ── 프로젝트 파일 자동 생성 ──────────────────────────────────────────
  const generateProject = async () => {
    if (isGenerating || agents.length === 0) return
    setIsGenerating(true)
    setGenStatus({ stage:'planning', message:'준비 중...' })
    setGenResult(null)

    const api = (window as any).electronAPI
    api.offProjectGenStatus()
    api.onProjectGenStatus((stage: string, message: string) => {
      setGenStatus({ stage, message })
    })

    // 각 에이전트의 마지막 산출물 수집
    const agentOutputs = agents.map(a => {
      const hist = states[a.name]?.history || []
      const lastAssistant = [...hist].reverse().find(m => m.role === 'assistant' && m.content.length > 50)
      return { agentName: a.name, agentRole: a.specialty, content: lastAssistant?.content || '(산출물 없음)' }
    })

    const result = await api.generateProjectFiles(projectTitle, agentOutputs, projectNote)
    api.offProjectGenStatus()

    if (result.cancelled) {
      setGenStatus(null)
      setIsGenerating(false)
      return
    }
    setGenStatus(null)
    setGenResult(result)
    setIsGenerating(false)
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (activeAgent.id === 'pm') requestProject(); else sendMessage()
  }

  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true
    const startY = e.clientY, startH = dialogHeight
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setDialogHeight(Math.max(160, Math.min(600, startH + (startY - ev.clientY)))) }
    const onUp = () => { isResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  const allAgents = [PM, ...agents]
  const canGenerate = agents.length > 0 && !isCreatingTeam && !isGenerating

  return (
    <div className="app-layout">
      {fullScreenHtml && <FullScreenPreview html={fullScreenHtml} onClose={() => setFullScreenHtml(null)} />}
      {(genStatus || genResult) && (
        <ProjectGenModal status={genStatus} result={genResult} onClose={() => { setGenResult(null); setGenStatus(null) }} />
      )}

      {/* 타이틀바 */}
      <div className="titlebar">
        <div className="titlebar-left">
          <span className="title-logo">♟ 두근두근 컴퍼니</span>
          {projectTitle && <span className="project-title-badge">📁 {projectTitle}</span>}
        </div>
        <div className="titlebar-right">
          {isCreatingTeam && <span className="creating-badge">⚙️ 팀 구성 중...</span>}
          {canGenerate && (
            <button className="gen-project-btn" onClick={generateProject}>
              🚀 프로젝트 파일 생성
            </button>
          )}
          {isGenerating && <span className="creating-badge">🔨 생성 중...</span>}
        </div>
      </div>

      <div className="main-area">
        {/* 사이드바 */}
        <aside className="sidebar">
          <div className="sidebar-sec">팀 ({allAgents.length}명)</div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {allAgents.map(agent => (
              <div key={agent.name}
                className={`agent-item ${activeAgent.name === agent.name ? 'active' : ''}`}
                onClick={() => setActiveAgent(agent)}>
                <div className="agent-avatar" style={{ background:agent.bg }}>{agent.emoji}</div>
                <div className="agent-info">
                  {agent.id === 'pm'
                    ? <div className="agent-name">{agent.name}</div>
                    : <AgentNameEditor agent={agent} onRename={handleRename} />
                  }
                  <div className="agent-role">
                    {agent.id === 'pm' ? '📌 PM (고정)' : agent.specialty}
                  </div>
                </div>
                <div className="status-dot" style={{ background: states[agent.name]?.loading ? '#fbbf24' : '#4ade80' }} />
              </div>
            ))}
            {agents.length === 0 && (
              <div className="empty-team">
                <div style={{ fontSize:26 }}>💬</div>
                <div>PM 지나에게 프로젝트를 요청하면 팀원이 자동으로 생성됩니다</div>
              </div>
            )}
          </div>
          <div className="sidebar-bottom">
            <button className="note-toggle-btn" onClick={() => setShowNote(!showNote)}>
              📋 프로젝트 노트 {projectNote ? '●' : ''}
            </button>
          </div>
        </aside>

        {/* 오피스 */}
        <div className="office-wrap">
          <div className="map-area">
            <div className="beta-tag">MAP BETA</div>
            {MAP_OBJECTS.map((obj, i) => (
              <div key={i} className="map-obj" style={{ left:obj.left, top:obj.top, width:obj.w, height:obj.h, background:obj.bg, borderColor:obj.bc }}>{obj.label}</div>
            ))}

            {/* PM 고정 */}
            <div className="char pm-char" style={{ left:PM_POS.left, top:PM_POS.top }} onClick={() => setActiveAgent(PM)}>
              <div className="pm-crown">👑 PM</div>
              {states[PM.name]?.loading && <div className="status-bubble">작업 중...</div>}
              <div className={`char-body ${states[PM.name]?.loading ? 'working' : 'idle'} ${activeAgent.name === PM.name ? 'selected' : ''}`}
                style={{ background:PM.bg, borderColor:PM.color, color:PM.color }}>{PM.emoji}</div>
              <div className="char-shadow" />
              <div className="char-tag" style={{ color:PM.color }}>{PM.name}</div>
            </div>

            {/* 팀원 */}
            {agents.map((agent, i) => {
              const pos = CHAR_SLOTS[i] || { left:50+(i%6)*80, top:72 }
              const isActive = activeAgent.name === agent.name
              const isLoading = states[agent.name]?.loading
              const taskLog = taskLogs.find(t => t.name === agent.name)
              return (
                <div key={agent.name} className="char" style={{ left:pos.left, top:pos.top }} onClick={() => setActiveAgent(agent)}>
                  {isLoading && <div className="status-bubble">작업 중...</div>}
                  {taskLog?.status === 'done' && !isLoading && <div className="status-bubble done-bubble">✅ 완료</div>}
                  <div className={`char-body ${isLoading?'working':'idle'} ${isActive?'selected':''}`}
                    style={{ background:agent.bg, borderColor:agent.color, color:agent.color }}>{agent.emoji}</div>
                  <div className="char-shadow" />
                  {/* 맵 캐릭터 아래 이름+직무 태그 */}
                  <div className="char-tag-group">
                    <div className="char-tag">{agent.name}</div>
                    <div className="char-role-tag">{agent.specialty}</div>
                  </div>
                </div>
              )
            })}

            {agents.length === 0 && !isCreatingTeam && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:32 }}>🏢</div>
                <div style={{ fontSize:12, color:'#3d2d60', textAlign:'center' }}>PM 지나에게 프로젝트를 요청하면<br />팀원들이 이 공간에 나타납니다</div>
              </div>
            )}
          </div>

          {/* 노트 패널 */}
          {showNote && (
            <div className="note-panel">
              <div className="note-header">
                <span>📋 프로젝트 노트 — 전 팀원이 이 내용을 알고 있습니다</span>
                <button className="note-close" onClick={() => setShowNote(false)}>✕</button>
              </div>
              <textarea className="note-textarea" value={projectNote} onChange={e => setProjectNote(e.target.value)} placeholder="프로젝트 관련 내용을 입력하세요." />
            </div>
          )}

          {/* 태스크 진행 패널 */}
          {taskLogs.length > 0 && (
            <div className="distribution-panel">
              <div className="distribution-title">{isCreatingTeam ? '⚙️ 팀 구성 및 업무 배분 진행 중' : '✅ 팀 구성 완료'}</div>
              <div className="distribution-tasks">
                {taskLogs.map((d, i) => (
                  <div key={i} className={`distribution-task ${d.status}`}>
                    <span className="dist-status">{d.status==='pending'?'⏸':d.status==='working'?'⚙️':'✅'}</span>
                    <span className="dist-nickname">{d.name}</span>
                    <span className="dist-task">{d.task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dialog-resize-handle" onMouseDown={startResize} />

          {/* 대화창 */}
          <div className="dialog-box" style={{ height:dialogHeight }}>
            <div className="dialog-portrait">
              <div className="portrait-face" style={{ borderColor:activeAgent.color }}>{activeAgent.emoji}</div>
              {activeAgent.id === 'pm' && <div style={{ fontSize:9, color:'#c084fc', marginTop:2 }}>📌 고정 PM</div>}
              <div className="portrait-name">{activeAgent.name}</div>
              <div className="portrait-role">{activeAgent.specialty}</div>
              <div className="portrait-status">
                <span style={{ width:5, height:5, borderRadius:'50%', background:st?.loading?'#fbbf24':'#4ade80', display:'inline-block' }} />
                {st?.loading ? '작업 중' : '대기 중'}
              </div>
            </div>

            <div className="dialog-content">
              <div className="dialog-speaker" style={{ color:activeAgent.color }}>
                {activeAgent.name}
                <span style={{ color:'#6b5a8a', fontWeight:400, marginLeft:6 }}>— {activeAgent.specialty}</span>
                {projectNote && <span className="context-badge">📋 컨텍스트</span>}
              </div>

              <div className="dialog-messages">
                {st?.history.map((msg, i) => (
                  <div key={i}>
                    {msg.role === 'user'
                      ? <div className="dialog-msg-user">{msg.content}</div>
                      : <div className="dialog-msg">
                          <MessageRenderer content={msg.content} agentId={activeAgent.id} />
                          {activeAgent.id === 'designer' && msg.content.match(/```html\n?([\s\S]*?)```/) && (
                            <div style={{ display:'flex', gap:6, marginTop:6 }}>
                              <button className="preview-fullscreen-btn" onClick={() => { const m=msg.content.match(/```html\n?([\s\S]*?)```/); if(m) setFullScreenHtml(m[1]) }}>⛶ 전체화면</button>
                              <button className="save-btn" onClick={() => { const m=msg.content.match(/```html\n?([\s\S]*?)```/); if(m) (window as any).electronAPI.saveFile(m[1].trim(), 'output.html') }}>💾 HTML 저장</button>
                            </div>
                          )}
                        </div>
                    }
                  </div>
                ))}
                {st?.loading && <div className="dialog-typing">▌</div>}
                <div ref={bottomRef} />
              </div>

              {!st?.loading && (() => {
                const lastMsg = st?.history[st.history.length - 1]
                if (!lastMsg || lastMsg.role !== 'assistant' || activeAgent.id === 'designer') return null
                if (!/```[\w]*\n?[\s\S]*?```/.test(lastMsg.content)) return null
                return <QuickCopyBar content={lastMsg.content} />
              })()}

              <div className="dialog-input-row">
                <input className="dialog-input"
                  value={st?.input ?? ''}
                  onChange={e => setStates(prev => ({ ...prev, [activeAgent.name]: { ...prev[activeAgent.name], input:e.target.value } }))}
                  onKeyDown={onEnter}
                  placeholder={activeAgent.id==='pm' ? '🏢 PM에게 프로젝트를 요청하면 팀을 자동 구성해드려요...' : `${activeAgent.name}에게 지시하기...`}
                  disabled={isCreatingTeam}
                />
                <button className="dialog-btn" onClick={() => { if(activeAgent.id==='pm') requestProject(); else sendMessage() }}
                  disabled={st?.loading || isCreatingTeam}>
                  {isCreatingTeam ? '⏳' : activeAgent.id==='pm' ? '🚀 요청' : '▶ 전송'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}