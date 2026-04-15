import { useState, useRef, useEffect } from 'react'
import './App.css'

const AGENT_TEMPLATES = [
  { id:'pm',         name:'기획 PM',       emoji:'👩‍💼', color:'#c084fc', bg:'#2d1f5e', desc:'프로젝트 기획, 태스크 분배, 일정 관리', specialty:'기획 및 프로젝트 관리' },
  { id:'designer',   name:'UI 디자이너',   emoji:'🎨',  color:'#f472b6', bg:'#3b0f2d', desc:'UI/UX 설계, 화면 구성, 시각 디자인', specialty:'UI/UX 디자인' },
  { id:'frontend',   name:'프론트엔드',    emoji:'💻',  color:'#60a5fa', bg:'#0c1a3a', desc:'React, HTML/CSS, 화면 개발', specialty:'프론트엔드 개발' },
  { id:'backend',    name:'백엔드',        emoji:'⚙️',  color:'#fb923c', bg:'#2a1500', desc:'API 설계, 서버, 데이터베이스', specialty:'백엔드 개발' },
  { id:'writer',     name:'콘텐츠 작가',   emoji:'✍️',  color:'#34d399', bg:'#0a2a1a', desc:'블로그, 카피라이팅, 문서 작성', specialty:'글쓰기 및 콘텐츠' },
  { id:'researcher', name:'리서처',        emoji:'🔬',  color:'#a78bfa', bg:'#1a0f3a', desc:'시장 조사, 데이터 분석, 리포트', specialty:'리서치 및 분석' },
  { id:'qa',         name:'QA 엔지니어',   emoji:'🔍',  color:'#f87171', bg:'#2a0a0a', desc:'테스트, 버그 리포트, 품질 검수', specialty:'QA 및 테스팅' },
  { id:'marketer',   name:'마케터',        emoji:'📣',  color:'#fbbf24', bg:'#2a1a00', desc:'마케팅 전략, SNS, 광고 카피', specialty:'마케팅 및 홍보' },
  { id:'analyst',    name:'데이터 분석가', emoji:'📊',  color:'#22d3ee', bg:'#0a1f2a', desc:'데이터 분석, 시각화, 인사이트 도출', specialty:'데이터 분석' },
  { id:'lawyer',     name:'법무 검토',     emoji:'⚖️',  color:'#94a3b8', bg:'#1a1f2a', desc:'계약서 검토, 법적 리스크 분석', specialty:'법무 및 컴플라이언스' },
]

const MAP_OBJECTS = [
  { label:'🖥️ 기획실',      left:20,  top:16, w:120, h:48, bg:'#1a1f35', bc:'#2d3a6a' },
  { label:'🎨 크리에이티브', left:180, top:16, w:120, h:48, bg:'#1f1535', bc:'#5a2d8e' },
  { label:'💻 개발팀',       left:340, top:16, w:110, h:48, bg:'#0f2a1a', bc:'#1a6a3a' },
  { label:'📋 회의실',       left:340, top:110,w:110, h:70, bg:'#2a1515', bc:'#8e2d2d' },
  { label:'☕ 휴게실',       left:20,  top:120,w:80,  h:50, bg:'#1a1a10', bc:'#6a6a1a' },
]

const CHAR_POSITIONS = [
  { left:50,  top:72  },
  { left:210, top:72  },
  { left:370, top:72  },
  { left:50,  top:170 },
  { left:210, top:170 },
  { left:370, top:170 },
]

type Template = typeof AGENT_TEMPLATES[0]
type HiredAgent = Template & { nickname: string }
type Msg = { role: 'user' | 'assistant'; content: string }
type AgentState = { history: Msg[]; input: string; loading: boolean }

function extractCode(text: string): { code: string; ext: string; lang: string } | null {
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
  for (const p of patterns) {
    const m = text.match(p.regex)
    if (m) return { code: m[1].trim(), ext: p.ext, lang: p.lang }
  }
  return null
}

async function saveCode(result: { code: string; ext: string }) {
  await (window as any).electronAPI.saveFile(result.code, `output.${result.ext}`)
}

function CodeBlock({ code, lang, ext }: { code: string; lang: string; ext: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{lang}</span>
        <button className="code-copy-btn" onClick={copy}>
          {copied ? '✓ 복사됨' : '📋 복사'}
        </button>
      </div>
      <pre className="code-content"><code>{code}</code></pre>
    </div>
  )
}

function QuickCopyBar({ content, lang }: { content: string; lang: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const codeBlocks: { code: string; lang: string }[] = []
  const regex = /```([\w]*)\n?([\s\S]*?)```/g
  const langMap: Record<string, string> = {
    tsx: 'TSX', typescript: 'TypeScript', javascript: 'JavaScript',
    jsx: 'JSX', python: 'Python', css: 'CSS', html: 'HTML', '': 'Code'
  }
  let match
  while ((match = regex.exec(content)) !== null) {
    codeBlocks.push({
      code: match[2].trim(),
      lang: langMap[match[1]] || match[1].toUpperCase() || 'Code'
    })
  }

  if (codeBlocks.length === 0) return null

  const copy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="quick-copy-bar">
      <span className="quick-copy-label">📋 코드 복사</span>
      <div className="quick-copy-btns">
        {codeBlocks.map((block, idx) => (
          <button key={idx} className="quick-copy-btn" onClick={() => copy(block.code, idx)}>
            {copiedIdx === idx ? '✓ 복사됨!' : `${idx + 1}. ${block.lang}`}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageRenderer({ content, agentId }: { content: string; agentId: string }) {
  if (agentId === 'designer') {
    const htmlMatch = content.match(/```html\n?([\s\S]*?)```/)
    if (htmlMatch) {
      const htmlCode = htmlMatch[1]
      const fullMatch = content.match(/```html[\s\S]*?```/)
      const beforeCode = content.substring(0, content.indexOf('```html')).trim()
      const afterCode = fullMatch
        ? content.substring(content.indexOf('```html') + fullMatch[0].length).trim()
        : ''
      return (
        <div>
          {beforeCode && <div style={{ whiteSpace:'pre-wrap', marginBottom:10 }}>{beforeCode}</div>}
          <div className="preview-container">
            <div className="preview-label">
              <span>🎨 UI 목업 미리보기</span>
            </div>
            <iframe
              className="html-preview"
              srcDoc={htmlCode}
              sandbox="allow-scripts"
              title="UI Preview"
            />
          </div>
          {afterCode && <div style={{ whiteSpace:'pre-wrap', marginTop:10 }}>{afterCode}</div>}
        </div>
      )
    }
    const textOnly = content.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*/g, '').trim()
    return (
      <div>
        {textOnly && <div style={{ whiteSpace:'pre-wrap' }}>{textOnly}</div>}
        {content.includes('```') && (
          <div className="generating-badge">🎨 목업 생성 중...</div>
        )}
      </div>
    )
  }

  // 일반 에이전트 — 코드블록을 CodeBlock 컴포넌트로 렌더링
  const parts: React.ReactNode[] = []
  let remaining = content
  let idx = 0
  const codeBlockRegex = /```([\w]*)\n?([\s\S]*?)```/g
  let match
  let lastIndex = 0

  const tempRegex = /```([\w]*)\n?([\s\S]*?)```/g
  while ((match = tempRegex.exec(content)) !== null) {
    // 코드블록 앞 텍스트
    if (match.index > lastIndex) {
      const text = content.substring(lastIndex, match.index).trim()
      if (text) parts.push(<div key={idx++} style={{ whiteSpace:'pre-wrap', marginBottom:8 }}>{text}</div>)
    }
    // 코드블록
    const lang = match[1]
    const code = match[2].trim()
    const langMap: Record<string, string> = {
      tsx: 'TSX', typescript: 'TypeScript', javascript: 'JavaScript',
      jsx: 'JSX', python: 'Python', css: 'CSS', html: 'HTML', '': 'Code'
    }
    const extMap: Record<string, string> = {
      tsx: 'tsx', typescript: 'ts', javascript: 'js',
      jsx: 'jsx', python: 'py', css: 'css', html: 'html', '': 'txt'
    }
    parts.push(
      <CodeBlock key={idx++} code={code} lang={langMap[lang] || lang.toUpperCase() || 'Code'} ext={extMap[lang] || 'txt'} />
    )
    lastIndex = match.index + match[0].length
  }
  // 마지막 남은 텍스트
  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) parts.push(<div key={idx++} style={{ whiteSpace:'pre-wrap', marginTop:8 }}>{text}</div>)
  }

  if (parts.length === 0) {
    return <div style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{content}</div>
  }
  return <div>{parts}</div>
}

function FullScreenPreview({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <div className="fullscreen-modal" onClick={e => e.stopPropagation()}>
        <div className="fullscreen-header">
          <span>🎨 UI 전체화면 미리보기</span>
          <button className="fullscreen-close" onClick={onClose}>✕ 닫기</button>
        </div>
        <iframe
          className="fullscreen-iframe"
          srcDoc={html}
          sandbox="allow-scripts"
          title="Full Preview"
        />
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<'office' | 'hire'>('office')
  const [hiredAgents, setHiredAgents] = useState<HiredAgent[]>([])
  const [activeAgent, setActiveAgent] = useState<HiredAgent | null>(null)
  const [projectNote, setProjectNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [hiringAgent, setHiringAgent] = useState<Template | null>(null)
  const [nickname, setNickname] = useState('')
  const [states, setStates] = useState<Record<string, AgentState>>({})
  const [dialogHeight, setDialogHeight] = useState(260)
  const [fullScreenHtml, setFullScreenHtml] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)

  const st = activeAgent ? states[activeAgent.nickname] : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [st?.history, st?.loading])

  const hireAgent = () => {
    if (!hiringAgent || !nickname.trim()) return
    const newAgent: HiredAgent = { ...hiringAgent, nickname: nickname.trim() }
    setHiredAgents(prev => [...prev, newAgent])
    setStates(prev => ({
      ...prev,
      [nickname.trim()]: {
        history: [{ role: 'assistant', content: `안녕하세요! 저는 ${nickname.trim()}입니다. ${hiringAgent.specialty} 전문가로 열심히 도와드릴게요!` }],
        input: '',
        loading: false
      }
    }))
    setNickname('')
    setHiringAgent(null)
    setScreen('office')
  }

  const fireAgent = (agent: HiredAgent) => {
    setHiredAgents(prev => prev.filter(a => a.nickname !== agent.nickname))
    setStates(prev => { const n = { ...prev }; delete n[agent.nickname]; return n })
    if (activeAgent?.nickname === agent.nickname) setActiveAgent(null)
  }

  const sendMessage = async () => {
    if (!activeAgent || !st?.input.trim() || st.loading) return
    const text = st.input.trim()
    const newHistory: Msg[] = [...st.history, { role: 'user', content: text }]

    setStates(prev => ({
      ...prev,
      [activeAgent.nickname]: {
        ...prev[activeAgent.nickname],
        history: [...newHistory, { role: 'assistant', content: '' }],
        input: '',
        loading: true
      }
    }))

    const agentNickname = activeAgent.nickname

    ;(window as any).electronAPI.offStream()
    ;(window as any).electronAPI.onStream((chunk: string) => {
      setStates(prev => {
        const agentState = prev[agentNickname]
        if (!agentState) return prev
        const history = [...agentState.history]
        const last = history[history.length - 1]
        if (last?.role === 'assistant') {
          history[history.length - 1] = { ...last, content: last.content + chunk }
        }
        return { ...prev, [agentNickname]: { ...agentState, history } }
      })
    })

    const result = await (window as any).electronAPI.askAgent(
      activeAgent.id, activeAgent.nickname, activeAgent.specialty, newHistory, projectNote
    )

    ;(window as any).electronAPI.offStream()

    if (result.ok) {
      const codeResult = extractCode(result.text)
      if (activeAgent.id === 'pm') {
        setProjectNote(prev => prev
          ? `${prev}\n\n[PM ${activeAgent.nickname} 기획]\n${result.text}`
          : `[PM ${activeAgent.nickname} 기획]\n${result.text}`)
      } else if (codeResult && ['designer', 'frontend', 'backend'].includes(activeAgent.id)) {
        setProjectNote(prev => {
          const entry = `\n\n[${activeAgent.name} ${activeAgent.nickname} 결과물 - .${codeResult.ext}]\n${codeResult.code}`
          return prev ? prev + entry : entry
        })
      } else if (result.text.length > 100) {
        setProjectNote(prev => {
          const entry = `\n\n[${activeAgent.name} ${activeAgent.nickname} 답변]\n${result.text}`
          return prev ? prev + entry : entry
        })
      }
    }

    setStates(prev => ({
      ...prev,
      [agentNickname]: { ...prev[agentNickname], loading: false }
    }))
  }

  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true
    const startY = e.clientY
    const startH = dialogHeight
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const delta = startY - ev.clientY
      setDialogHeight(Math.max(160, Math.min(600, startH + delta)))
    }
    const onUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // 고용 화면
  if (screen === 'hire') {
    return (
      <div className="app-layout">
        <div className="titlebar">
          <div className="titlebar-left">
            <span className="title-logo">♟ 두근두근 컴퍼니</span>
            <span className="title-sub">에이전트 고용</span>
          </div>
          <button className="note-toggle-btn" style={{ width:'auto', padding:'4px 12px' }}
            onClick={() => setScreen('office')}>← 사무실로</button>
        </div>
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          <aside className="sidebar">
            <div className="sidebar-sec">내 팀 ({hiredAgents.length}명)</div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {hiredAgents.map(a => (
                <div key={a.nickname} className="agent-item"
                  onClick={() => { setScreen('office'); setActiveAgent(a) }}>
                  <div className="agent-avatar" style={{ background: a.bg }}>{a.emoji}</div>
                  <div className="agent-info">
                    <div className="agent-name">{a.nickname}</div>
                    <div className="agent-role">{a.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
          <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div className="titlebar" style={{ background:'#13101f', borderBottom:'1px solid #2d2540' }}>
              <span style={{ fontSize:13, color:'#9d8abf' }}>전문가를 선택하고 이름을 붙여 팀에 합류시키세요</span>
            </div>
            <div className="hire-grid">
              {AGENT_TEMPLATES.map(t => (
                <div key={t.id}
                  className={`hire-card ${hiringAgent?.id === t.id ? 'selected' : ''}`}
                  onClick={() => { setHiringAgent(t); setNickname(t.name) }}>
                  <div className="hire-emoji">{t.emoji}</div>
                  <div className="hire-name">{t.name}</div>
                  <div className="hire-desc">{t.desc}</div>
                  {hiredAgents.some(a => a.id === t.id) && (
                    <span className="hire-badge-done">고용됨</span>
                  )}
                </div>
              ))}
            </div>
            {hiringAgent && (
              <div className="hire-confirm">
                <span style={{ fontSize:22 }}>{hiringAgent.emoji}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#9d8abf', marginBottom:4 }}>
                    {hiringAgent.name} — 이름을 지어주세요
                  </div>
                  <input
                    className="dialog-input"
                    style={{ width:'100%' }}
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && hireAgent()}
                    placeholder="예: 지나, 준혁, Alex..."
                    autoFocus
                  />
                </div>
                <button className="dialog-btn" onClick={hireAgent}>고용 ✓</button>
              </div>
            )}
          </main>
        </div>
      </div>
    )
  }

  // 메인 오피스 화면
  return (
    <div className="app-layout">
      {fullScreenHtml && (
        <FullScreenPreview html={fullScreenHtml} onClose={() => setFullScreenHtml(null)} />
      )}

      <div className="titlebar">
        <div className="titlebar-left">
          <span className="title-logo">♟ 두근두근 컴퍼니</span>
          <span className="title-sub">AI Agent Office</span>
        </div>
        <div className="gold-badge">🪙 골드 시스템 준비 중</div>
      </div>

      <div className="main-area">
        <aside className="sidebar">
          <div className="sidebar-sec">내 팀 ({hiredAgents.length}명)</div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {hiredAgents.length === 0 ? (
              <div className="empty-team">
                <div style={{ fontSize:28 }}>👥</div>
                <div>팀원이 없어요.<br/>아래 버튼으로 고용하세요!</div>
              </div>
            ) : (
              hiredAgents.map(agent => (
                <div key={agent.nickname}
                  className={`agent-item ${activeAgent?.nickname === agent.nickname ? 'active' : ''}`}
                  onClick={() => setActiveAgent(agent)}>
                  <div className="agent-avatar" style={{ background: agent.bg }}>{agent.emoji}</div>
                  <div className="agent-info">
                    <div className="agent-name">{agent.nickname}</div>
                    <div className="agent-role">{agent.name}</div>
                  </div>
                  <div className="status-dot"
                    style={{ background: states[agent.nickname]?.loading ? '#fbbf24' : '#4ade80' }} />
                  <button className="fire-btn"
                    onClick={e => { e.stopPropagation(); fireAgent(agent) }}
                    title="해고">✕</button>
                </div>
              ))
            )}
          </div>
          <div className="sidebar-bottom">
            <button className="hire-btn" onClick={() => setScreen('hire')}>+ 에이전트 고용</button>
            <button className="note-toggle-btn" onClick={() => setShowNote(!showNote)}>
              📋 프로젝트 노트 {projectNote ? '●' : ''}
            </button>
          </div>
        </aside>

        <div className="office-wrap">
          {/* 오피스 맵 */}
          <div className="map-area">
            <div className="beta-tag">MAP BETA</div>
            {MAP_OBJECTS.map((obj, i) => (
              <div key={i} className="map-obj" style={{
                left:obj.left, top:obj.top, width:obj.w, height:obj.h,
                background:obj.bg, borderColor:obj.bc
              }}>{obj.label}</div>
            ))}
            {hiredAgents.map((agent, i) => {
              const pos = CHAR_POSITIONS[i] || { left: 50 + (i % 5) * 90, top: 72 }
              const isActive = activeAgent?.nickname === agent.nickname
              const isLoading = states[agent.nickname]?.loading
              return (
                <div key={agent.nickname} className="char"
                  style={{ left:pos.left, top:pos.top }}
                  onClick={() => setActiveAgent(agent)}>
                  {isLoading && <div className="status-bubble">작업 중...</div>}
                  <div className={`char-body ${isLoading ? 'working' : 'idle'} ${isActive ? 'selected' : ''}`}
                    style={{ background:agent.bg, borderColor:agent.color, color:agent.color }}>
                    {agent.emoji}
                  </div>
                  <div className="char-shadow" />
                  <div className="char-tag">{agent.nickname}</div>
                </div>
              )
            })}
            {hiredAgents.length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                justifyContent:'center', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:32 }}>🏢</div>
                <div style={{ fontSize:12, color:'#3d2d60' }}>에이전트를 고용하면 사무실에 나타납니다</div>
              </div>
            )}
          </div>

          {/* 노트 패널 */}
          {showNote && (
            <div className="note-panel">
              <div className="note-header">
                <span>📋 프로젝트 노트 — 모든 에이전트가 이 내용을 알고 있습니다</span>
                <button className="note-close" onClick={() => setShowNote(false)}>✕</button>
              </div>
              <textarea className="note-textarea" value={projectNote}
                onChange={e => setProjectNote(e.target.value)}
                placeholder="프로젝트 관련 내용을 입력하세요." />
            </div>
          )}

          {/* 리사이즈 핸들 */}
          <div className="dialog-resize-handle" onMouseDown={startResize} />

          {/* 대화창 */}
          <div className="dialog-box" style={{ height: dialogHeight }}>
            {!activeAgent ? (
              <div className="dialog-empty">
                ↑ 사무실에서 캐릭터를 클릭하거나 왼쪽에서 에이전트를 선택하세요
              </div>
            ) : (
              <>
                <div className="dialog-portrait">
                  <div className="portrait-face" style={{ borderColor: activeAgent.color }}>
                    {activeAgent.emoji}
                  </div>
                  <div className="portrait-name">{activeAgent.nickname}</div>
                  <div className="portrait-status">
                    <span style={{ width:5, height:5, borderRadius:'50%',
                      background: st?.loading ? '#fbbf24' : '#4ade80', display:'inline-block' }} />
                    {st?.loading ? '작업 중' : '대기 중'}
                  </div>
                </div>
                <div className="dialog-content">
                  <div className="dialog-speaker" style={{ color: activeAgent.color }}>
                    {activeAgent.nickname} — {activeAgent.name}
                    {projectNote && (
                      <span className="context-badge" style={{ marginLeft:8 }}>📋 컨텍스트</span>
                    )}
                  </div>
                  <div className="dialog-messages">
                    {st?.history.map((msg, i) => {
                      const isLastMsg = i === (st?.history.length ?? 0) - 1
                      const lastCode = isLastMsg && msg.role === 'assistant'
                        ? extractCode(msg.content)
                        : null
                      return (
                        <div key={i}>
                          {msg.role === 'user'
                            ? <div className="dialog-msg-user">{msg.content}</div>
                            : <div className="dialog-msg">
                                <MessageRenderer content={msg.content} agentId={activeAgent.id} />
                                {activeAgent.id === 'designer' && msg.content.match(/```html\n?([\s\S]*?)```/) && (
                                  <div style={{ display:'flex', gap:6, marginTop:6 }}>
                                    <button className="preview-fullscreen-btn"
                                      onClick={() => {
                                        const m = msg.content.match(/```html\n?([\s\S]*?)```/)
                                        if (m) setFullScreenHtml(m[1])
                                      }}>
                                      ⛶ 전체화면
                                    </button>
                                    <button className="save-btn"
                                      onClick={() => {
                                        const m = msg.content.match(/```html\n?([\s\S]*?)```/)
                                        if (m) saveCode({ code: m[1].trim(), ext: 'html' })
                                      }}>
                                      💾 HTML 저장
                                    </button>
                                  </div>
                                )}
                              </div>
                          }
                        </div>
                      )
                    })}
                    {st?.loading && <div className="dialog-typing">▌</div>}
                    <div ref={bottomRef} />
                  </div>

                  {/* 마지막 코드 빠른 복사 바 */}
                  {!st?.loading && (() => {
                    const lastMsg = st?.history[st.history.length - 1]
                    if (!lastMsg || lastMsg.role !== 'assistant') return null
                    if (activeAgent.id === 'designer') return null
                    const hasCode = /```[\w]*\n?[\s\S]*?```/.test(lastMsg.content)
                    if (!hasCode) return null
                    return <QuickCopyBar content={lastMsg.content} lang="" />
                  })()}
                  <div className="dialog-input-row">
                    <input className="dialog-input"
                      value={st?.input ?? ''}
                      onChange={e => setStates(prev => ({
                        ...prev,
                        [activeAgent.nickname]: { ...prev[activeAgent.nickname], input: e.target.value }
                      }))}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      placeholder={`${activeAgent.nickname}에게 지시하기...`}
                    />
                    <button className="dialog-btn" onClick={sendMessage} disabled={st?.loading}>
                      ▶ 전송
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}