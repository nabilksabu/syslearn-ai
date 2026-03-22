import { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { fetchRepo } from './lib/github'
import { analyzeRepo, chatWithRepo } from './lib/ai'
import './App.css'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#1a2035',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#2d3f6e',
    lineColor: '#4a9eff',
    background: '#0d1117',
    mainBkg: '#161b27',
    nodeBorder: '#2d4a6e',
    titleColor: '#4a9eff',
    edgeLabelBackground: '#161b27',
    fontFamily: 'DM Mono, monospace',
  }
})

const STEPS = [
  'Fetching repository...',
  'Reading important files...',
  'Analyzing architecture...',
  'Building diagram...',
  'Preparing your lesson...',
]

export default function App() {
  const [url, setUrl] = useState('')
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_key') || '')
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('groq_key') || '')
  const [showKeys, setShowKeys] = useState(false)
  const [phase, setPhase] = useState('home')
  const [stepIdx, setStepIdx] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('architecture')
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [diagramSvg, setDiagramSvg] = useState('')
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (geminiKey) localStorage.setItem('gemini_key', geminiKey)
    if (groqKey) localStorage.setItem('groq_key', groqKey)
  }, [geminiKey, groqKey])

  useEffect(() => {
    if (analysis?.mermaid) renderDiagram(analysis.mermaid)
  }, [analysis])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function renderDiagram(code) {
    try {
      const { svg } = await mermaid.render('diag-' + Date.now(), code)
      setDiagramSvg(svg)
    } catch {
      setDiagramSvg('<p style="color:#ff6b6b;padding:2rem">Could not render diagram.</p>')
    }
  }

  async function handleAnalyze() {
    if (!url.trim()) return
    if (!geminiKey && !groqKey) { setShowKeys(true); return }
    setError(null)
    setPhase('loading')
    setStepIdx(0)
    const timer = setInterval(() => setStepIdx(i => Math.min(i + 1, STEPS.length - 1)), 1800)
    try {
      const repoData = await fetchRepo(url.trim())
      const result = await analyzeRepo(repoData, geminiKey, groqKey)
      clearInterval(timer)
      setAnalysis({ ...result, repoData })
      setChatHistory([{ role: 'assistant', content: `I've analyzed **${repoData.owner}/${repoData.repo}**. ${result.summary} Ask me anything about how it's built.` }])
      setPhase('lesson')
    } catch (e) {
      clearInterval(timer)
      setError(e.message)
      setPhase('home')
    }
  }

  function speak(text) {
    if (!window.speechSynthesis) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.92
    u.onend = () => setSpeaking(false)
    setSpeaking(true)
    speechSynthesis.speak(u)
  }

  function stopSpeaking() { speechSynthesis.cancel(); setSpeaking(false) }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return
    const q = chatInput.trim()
    setChatInput('')
    setChatHistory(h => [...h, { role: 'user', content: q }])
    setChatLoading(true)
    try {
      const ans = await chatWithRepo(q, analysis, chatHistory, geminiKey, groqKey)
      setChatHistory(h => [...h, { role: 'assistant', content: ans }])
    } catch (e) {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Error: ' + e.message }])
    }
    setChatLoading(false)
  }

  /* ── LOADING ─────────────────────────────────────────── */
  if (phase === 'loading') return (
    <div className="loading-screen">
      <div className="load-orb" />
      <div className="load-box">
        <div className="load-url">{url}</div>
        <div className="load-step">{STEPS[stepIdx]}</div>
        <div className="load-track"><div className="load-fill" style={{ width: `${(stepIdx + 1) / STEPS.length * 100}%` }} /></div>
        <div className="load-dots">{STEPS.map((_, i) => <div key={i} className={`load-dot ${i <= stepIdx ? 'on' : ''} ${i === stepIdx ? 'cur' : ''}`} />)}</div>
      </div>
    </div>
  )

  /* ── LESSON ──────────────────────────────────────────── */
  if (phase === 'lesson') return (
    <div className="lesson-wrap">
      <aside className="sidebar">
        <div className="sb-logo"><span className="sb-mark">S</span><span className="sb-name">SysLearn</span></div>
        <div className="sb-repo">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          {analysis.repoData.owner}/{analysis.repoData.repo}
        </div>
        <div className="sb-stack">{analysis.techStack?.map(t => <span key={t} className="tech-pill">{t}</span>)}</div>
        <nav className="sb-nav">
          {[['architecture','◈','Architecture'],['diagram','⬡','Diagram'],['lessons','◎','Lessons'],['code','⌥','Code Guide'],['chat','◉','Chat Tutor']].map(([id, ic, label]) => (
            <button key={id} className={`nav-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              <span className="nav-ic">{ic}</span><span>{label}</span>
              {id === 'chat' && chatHistory.length > 1 && <span className="nav-badge">{chatHistory.length - 1}</span>}
            </button>
          ))}
        </nav>
        <button className="sb-back" onClick={() => { setPhase('home'); setAnalysis(null); stopSpeaking() }}>← New repo</button>
      </aside>

      <main className="lesson-main">
        {activeTab === 'architecture' && (
          <div className="tab">
            <div className="tab-head">
              <h1>System Architecture</h1>
              <button className={`speak-btn ${speaking ? 'on' : ''}`} onClick={() => speaking ? stopSpeaking() : speak(analysis.architecture)}>{speaking ? '⏸ Stop' : '▶ Listen'}</button>
            </div>
            <div className="summary-card"><p>{analysis.summary}</p></div>
            <div className="arch-body">{analysis.architecture?.split('\n').filter(Boolean).map((p,i) => <p key={i}>{p}</p>)}</div>
            <div className="comp-grid">
              {analysis.components?.map(c => (
                <div key={c.name} className="comp-card">
                  <div className="comp-name">{c.name}</div>
                  <div className="comp-role">{c.role}</div>
                  {c.connects?.length > 0 && <div className="comp-links">{c.connects.map(x => <span key={x} className="link-tag">{x}</span>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'diagram' && (
          <div className="tab">
            <div className="tab-head"><h1>Architecture Diagram</h1></div>
            <div className="diagram-box" dangerouslySetInnerHTML={{ __html: diagramSvg }} />
          </div>
        )}

        {activeTab === 'lessons' && (
          <div className="tab">
            <div className="tab-head">
              <h1>System Design Lessons</h1>
              <button className={`speak-btn ${speaking ? 'on' : ''}`} onClick={() => speaking ? stopSpeaking() : speak(analysis.lessons?.map(l => `${l.title}. ${l.explanation}`).join('. '))}>{speaking ? '⏸ Stop' : '▶ Listen all'}</button>
            </div>
            <div className="lessons">
              {analysis.lessons?.map((l, i) => (
                <div key={i} className="lesson-card">
                  <div className="lesson-num">0{i+1}</div>
                  <div className="lesson-body"><div className="lesson-title">{l.title}</div><div className="lesson-exp">{l.explanation}</div></div>
                  <button className="lesson-play" onClick={() => speak(`${l.title}. ${l.explanation}`)}>▶</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="tab">
            <div className="tab-head">
              <h1>Contributor Guide</h1>
              <button className={`speak-btn ${speaking ? 'on' : ''}`} onClick={() => speaking ? stopSpeaking() : speak(analysis.codeExplainer)}>{speaking ? '⏸ Stop' : '▶ Listen'}</button>
            </div>
            <div className="summary-card"><p style={{color:'var(--muted)',fontStyle:'italic'}}>Everything you need to start contributing to this repo.</p></div>
            <div className="arch-body">{analysis.codeExplainer?.split('\n').filter(Boolean).map((p,i) => <p key={i}>{p}</p>)}</div>
            <div className="files-list">
              <h3>Files analyzed</h3>
              {analysis.repoData?.files?.map(f => (
                <div key={f.path} className="file-row"><span className="file-ic">◈</span><span className="file-path">{f.path}</span></div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="tab chat-tab">
            <div className="tab-head"><h1>Chat Tutor</h1><span className="chat-hint">Ask anything about this codebase</span></div>
            <div className="chat-msgs">
              {chatHistory.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  <div className="msg-av">{m.role === 'user' ? 'You' : 'AI'}</div>
                  <div className="msg-text">{m.content.split('**').map((p,j) => j%2===1 ? <strong key={j}>{p}</strong> : p)}</div>
                  {m.role === 'assistant' && <button className="msg-play" onClick={() => speak(m.content)}>▶</button>}
                </div>
              ))}
              {chatLoading && <div className="chat-msg assistant"><div className="msg-av">AI</div><div className="msg-text typing"><span/><span/><span/></div></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-bar">
              <input className="chat-in" placeholder="Why is there a message queue? What does index.js do?" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
              <button className="chat-go" onClick={sendChat} disabled={chatLoading}>{chatLoading ? '…' : '↑'}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )

  /* ── HOME ────────────────────────────────────────────── */
  return (
    <div className="home">
      <div className="home-bg"><div className="grid" /><div className="glow g1" /><div className="glow g2" /></div>

      <header className="hdr">
        <div className="hdr-logo"><span className="sb-mark">S</span><span className="sb-name">SysLearn</span></div>
        <button className="keys-toggle" onClick={() => setShowKeys(!showKeys)}>{(geminiKey||groqKey) ? '● Keys saved' : '+ Add keys'}</button>
      </header>

      {showKeys && (
        <div className="keys-panel">
          <div className="keys-inner">
            <h3>API Keys <span>(stored locally in your browser)</span></h3>
            <input className="key-in" placeholder="Gemini API key — aistudio.google.com" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} type="password" />
            <input className="key-in" placeholder="Groq API key — console.groq.com" value={groqKey} onChange={e => setGroqKey(e.target.value)} type="password" />
            <button className="key-save" onClick={() => setShowKeys(false)}>Save & close</button>
          </div>
        </div>
      )}

      <div className="hero">
        <div className="eyebrow">Open-source learning tool</div>
        <h1 className="hero-h1">Understand any<br/><em>codebase</em> in minutes</h1>
        <p className="hero-p">Paste a GitHub URL. Get architecture diagrams, voice walkthrough,<br/>system design lessons, and an AI tutor for the codebase.</p>

        <div className="url-bar">
          <svg className="url-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          <input className="url-in" placeholder="https://github.com/vercel/next.js" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnalyze()} />
          <button className="url-go" onClick={handleAnalyze}>Analyze →</button>
        </div>

        {error && <div className="err">⚠ {error}</div>}

        <div className="examples">
          <span>Try:</span>
          {['facebook/react','expressjs/express','tiangolo/fastapi','django/django'].map(r => (
            <button key={r} className="ex-btn" onClick={() => setUrl(`https://github.com/${r}`)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="features">
        {[
          ['⬡','Architecture diagram','Auto-generated from your code, not a template'],
          ['▶','Voice walkthrough','The diagram narrates itself. Free, browser-native'],
          ['◉','Chat tutor','Ask questions, get mentor-style answers'],
          ['◎','Design lessons','Extracts real system design patterns from the repo'],
        ].map(([ic,t,d]) => (
          <div key={t} className="feat-card">
            <div className="feat-ic">{ic}</div>
            <div className="feat-title">{t}</div>
            <div className="feat-desc">{d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
