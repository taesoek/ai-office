import { useState, useRef, useEffect } from 'react'
import './App.css'

const AGENTS = [
  { id:'pm',       name:'지나', role:'PM',        emoji:'👩‍💼', color:'#6366f1', desc:'기획 · 태스크 분배' },
  { id:'design',   name:'다운', role:'디자이너',   emoji:'🎨',  color:'#ec4899', desc:'UI · 시안 설계' },
  { id:'frontend', name:'준혁', role:'프론트엔드', emoji:'💻',  color:'#10b981', desc:'React · 화면 개발' },
  { id:'backend',  name:'민서', role:'백엔드',     emoji:'⚙️',  color:'#f59e0b', desc:'API · 서버 · DB' },
  { id:'qa',       name:'소은', role:'QA',         emoji:'🔍',  color:'#8b5cf6', desc:'테스트 · 품질 검수' },
]

type Msg = { role: 'user' | 'assistant'; content: string }
type AgentState = { history: Msg[]; input: string; loading: boolean }

function extractCode(text: string): string | null {
  const match = text.match(/```[\w]*\n?([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

async function saveCode(code: string) {
  const ext = code.startsWith('<') ? 'html' :
               code.includes('def ') ? 'py' :
               code.includes('import React') ? 'tsx' : 'ts'
  await (window as any).electronAPI.saveFile(code, `output.${ext}`)
}

export default function App() {
  const [activeAgent, setActiveAgent] = useState(AGENTS[0])
  const [projectNote, setProjectNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [states, setStates] = useState<Record<string, AgentState>>(
    Object.fromEntries(AGENTS.map(a => [a.id, {
      history: [{ role: 'assistant', content: `안녕하세요! ${a.role} ${a.name}입니다. 무엇을 도와드릴까요?` }],
      input: '',
      loading: false
    }]))
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const st = states[activeAgent.id]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [st.history, st.loading])

  const sendMessage = async () => {
    if (!st.input.trim() || st.loading) return
    const text = st.input.trim()
    const newHistory: Msg[] = [...st.history, { role: 'user', content: text }]

    setStates(prev => ({
      ...prev,
      [activeAgent.id]: { ...prev[activeAgent.id], history: newHistory, input: '', loading: true }
    }))

    const result = await (window as any).electronAPI.askAgent(
      activeAgent.id,
      activeAgent.name,
      activeAgent.role,
      newHistory,
      projectNote
    )

    if (activeAgent.id === 'pm' && result.ok) {
      setProjectNote(prev =>
        prev
          ? `${prev}\n\n[PM 지나 - 최신 기획]\n${result.text}`
          : `[PM 지나 - 기획]\n${result.text}`
      )
    }

    setStates(prev => ({
      ...prev,
      [activeAgent.id]: {
        ...prev[activeAgent.id],
        history: [...newHistory, { role: 'assistant', content: result.text }],
        loading: false
      }
    }))
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">AI Office</span>
          <span className="sidebar-sub">에이전트 팀</span>
        </div>
        <div className="agent-list">
          {AGENTS.map(agent => (
            <div key={agent.id}
              className={`agent-card ${activeAgent.id === agent.id ? 'active' : ''}`}
              onClick={() => setActiveAgent(agent)}>
              <div className="agent-emoji" style={{ background: agent.color + '22' }}>{agent.emoji}</div>
              <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                <div className="agent-role">{agent.role} · {agent.desc}</div>
              </div>
              <div className="agent-dot" style={{ background: agent.color }} />
            </div>
          ))}
        </div>
        <div className="note-section">
          <button className="note-toggle-btn" onClick={() => setShowNote(!showNote)}>
            📋 프로젝트 노트 {projectNote ? '●' : ''}
          </button>
        </div>
      </aside>

      <main className="chat-area">
        <div className="chat-header">
          <span className="chat-emoji">{activeAgent.emoji}</span>
          <div>
            <div className="chat-name">{activeAgent.name}</div>
            <div className="chat-role">{activeAgent.role} — {activeAgent.desc}</div>
          </div>
          {projectNote && (
            <div className="context-badge">📋 프로젝트 컨텍스트 공유 중</div>
          )}
        </div>

        {showNote && (
          <div className="note-panel">
            <div className="note-header">
              <span>📋 프로젝트 노트 — 모든 에이전트가 이 내용을 알고 있습니다</span>
              <button className="note-close" onClick={() => setShowNote(false)}>✕</button>
            </div>
            <textarea
              className="note-textarea"
              value={projectNote}
              onChange={e => setProjectNote(e.target.value)}
              placeholder="프로젝트 관련 내용을 입력하세요. 모든 에이전트가 이 내용을 바탕으로 답변합니다."
            />
          </div>
        )}

        <div className="messages">
          {st.history.map((msg, i) => (
            <div key={i} className={`message-row ${msg.role === 'user' ? 'user' : 'agent'}`}>
              {msg.role === 'assistant' && <div className="msg-avatar">{activeAgent.emoji}</div>}
              <div className="msg-bubble">
                {msg.role === 'assistant' && <div className="msg-from">{activeAgent.name}</div>}
                <div className={`msg-text ${msg.role === 'user' ? 'user-text' : 'agent-text'}`}>
                  {msg.content}
                </div>
                {msg.role === 'assistant' && extractCode(msg.content) && (
                  <button className="save-btn" onClick={() => saveCode(extractCode(msg.content)!)}>
                    💾 파일로 저장
                  </button>
                )}
              </div>
            </div>
          ))}
          {st.loading && (
            <div className="message-row agent">
              <div className="msg-avatar">{activeAgent.emoji}</div>
              <div className="msg-bubble">
                <div className="msg-from">{activeAgent.name}</div>
                <div className="msg-text agent-text typing">입력 중...</div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="input-bar">
          <input className="chat-input"
            value={st.input}
            onChange={e => setStates(prev => ({ ...prev, [activeAgent.id]: { ...prev[activeAgent.id], input: e.target.value } }))}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={`${activeAgent.name}에게 지시하기...`}
          />
          <button className="send-btn" onClick={sendMessage} disabled={st.loading}>전송</button>
        </div>
      </main>
    </div>
  )
}