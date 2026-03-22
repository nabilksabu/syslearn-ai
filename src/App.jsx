import { useState, useEffect, useRef, useCallback } from 'react'
import mermaid from 'mermaid'
import { fetchRepo } from './lib/github'
import { analyzeRepo, chatWithRepo, deepDive as deepDiveAI, getGeminiKey, getGroqKey } from './lib/ai'
import { auth, signInWithGoogle, signOut, onAuthStateChanged, saveAnalysis, getRecentAnalyses } from './lib/firebase'
import './App.css'

mermaid.initialize({
  startOnLoad: false, theme: 'dark',
  themeVariables: {
    primaryColor: '#1e2d4a', primaryTextColor: '#e2e8f0', primaryBorderColor: '#2d4a7a',
    lineColor: '#4a9eff', background: '#080c14', mainBkg: '#0f1829',
    nodeBorder: '#2d4a7a', titleColor: '#4a9eff', edgeLabelBackground: '#0f1829',
    fontFamily: 'JetBrains Mono, monospace', fontSize: '13px'
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function getBestVoice() {
  const vs = speechSynthesis.getVoices()
  for (const n of ['Google UK English Male','Google UK English Female','Google US English','Microsoft David','Alex','Daniel']) {
    const v = vs.find(x => x.name.includes(n)); if (v) return v
  }
  return vs.find(v => v.lang?.startsWith('en')) || null
}
function speakText(text, onEnd) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const chunks = text.match(/.{1,220}(?:\s|$)/g) || [text]; let i = 0
  const next = () => {
    if (i >= chunks.length) { onEnd?.(); return }
    const u = new SpeechSynthesisUtterance(chunks[i++])
    u.voice = getBestVoice(); u.rate = 0.9; u.pitch = 1; u.volume = 1
    u.onend = next; u.onerror = next; speechSynthesis.speak(u)
  }
  speechSynthesis.getVoices().length ? next() : (speechSynthesis.onvoiceschanged = next)
}
function sanitizeMermaid(code) {
  if (!code) return ''
  let c = code.replace(/```mermaid\n?|```\n?/g, '').trim()
  c = c.replace(/\[([^\]]*)\]/g, (_, i) => '[' + i.replace(/[^\w\s\-/.]/g, '').trim() + ']')
  return c
}
function fileColor(p = '') {
  if (/\.(js|jsx|ts|tsx)$/.test(p)) return '#4a9eff'
  if (/\.py$/.test(p)) return '#34d399'
  if (/\.(md|txt)$/.test(p)) return '#94a3b8'
  if (/\.(json|yaml|yml|toml)$/.test(p)) return '#fb923c'
  if (/\.(css|scss)$/.test(p)) return '#f472b6'
  if (/\.(go|rs|java|rb)$/.test(p)) return '#a78bfa'
  return '#64748b'
}
function layerColor(l) {
  return ({api:'#4a9eff',data:'#34d399',ui:'#a78bfa',infra:'#fb923c',util:'#64748b'})[l]||'#64748b'
}
function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now()-ts)/1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}
const STEPS = [
  {icon:'⬡',label:'Fetching repository tree'},
  {icon:'◈',label:'Scoring and selecting key files'},
  {icon:'◉',label:'Analyzing with AI'},
  {icon:'⊕',label:'Building architecture map'},
  {icon:'▶',label:'Preparing your lesson'},
]
const NAV = [
  {id:'overview',    icon:'🏠', label:'Overview'},
  {id:'architecture',icon:'🏛', label:'Architecture'},
  {id:'diagram',     icon:'🗺', label:'Diagram'},
  {id:'lessons',     icon:'📚', label:'Lessons'},
  {id:'snippets',    icon:'💻', label:'Code Snippets'},
  {id:'concepts',    icon:'🧠', label:'Concepts'},
  {id:'deepdive',    icon:'🔍', label:'Deep Dive'},
  {id:'guide',       icon:'🗂', label:'Contributor Guide'},
  {id:'chat',        icon:'💬', label:'Chat Tutor'},
]

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('sl_theme')||'dark')
  const [phase, setPhase] = useState('home')
  const [stepIdx, setStepIdx] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const [diagramSvg, setDiagramSvg] = useState('')
  const [diagramScale, setDiagramScale] = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [visited, setVisited] = useState(new Set(['overview']))
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem('sl_history')||'[]') } catch { return [] } })
  const [ddFile, setDdFile] = useState('')
  const [ddQ, setDdQ] = useState('')
  const [ddResult, setDdResult] = useState('')
  const [ddLoading, setDdLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsGemini, setSettingsGemini] = useState('')
  const [settingsGroq, setSettingsGroq] = useState('')
  const [lessonsRead, setLessonsRead] = useState(new Set())
  const chatEndRef = useRef(null)
  const mainRef = useRef(null)

  useEffect(() => { const u = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false) }); return u }, [])
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('sl_theme', theme) }, [theme])
  useEffect(() => { const p = new URLSearchParams(window.location.search).get('repo'); if (p) setUrl(`https://github.com/${p}`) }, [])
  useEffect(() => { if (analysis?.mermaid) renderDiagram(analysis.mermaid) }, [analysis])
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [chatHistory])
  useEffect(() => { if (user) getRecentAnalyses(user.uid).then(d => { if (d.length) setRecent(d) }) }, [user])

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''), 2500) }
  function goTab(id) { setTab(id); setVisited(v => new Set([...v, id])); mainRef.current?.scrollTo(0,0) }

  async function renderDiagram(code) {
    const clean = sanitizeMermaid(code)
    // mermaid v11 requires a real DOM container element as 2nd arg
    const mkContainer = () => {
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden'
      document.body.appendChild(el)
      return el
    }
    const tryRender = async (src) => {
      const el = mkContainer()
      try {
        const { svg } = await mermaid.render('md' + Date.now(), src, el)
        return svg
      } finally {
        el.remove()
      }
    }
    try { const svg = await tryRender(clean); setDiagramSvg(svg); return } catch(e) { console.warn('Mermaid primary render failed:', e?.message) }
    if (analysis?.components?.length) {
      const nodes = analysis.components.map(c=>`  ${c.name.replace(/[^\w]/g,'_')}["${c.name}"]`).join('\n')
      const edges = analysis.components.flatMap(c=>(c.connects||[]).map(x=>`  ${c.name.replace(/[^\w]/g,'_')} --> ${x.replace(/[^\w]/g,'_')}`)).join('\n')
      try { const svg = await tryRender(`flowchart TD\n${nodes}\n${edges}`); setDiagramSvg(svg); return } catch(e) { console.warn('Mermaid fallback render failed:', e?.message) }
    }
    setDiagramSvg('<p class="diag-err">Could not render diagram. Try re-analyzing.</p>')
  }

  async function handleAnalyze() {
    if (!url.trim()) return
    if (!user) { setError('Sign in with Google to analyze repos.'); return }
    setError(null); setPhase('loading'); setStepIdx(0)
    const timer = setInterval(()=>setStepIdx(i=>Math.min(i+1,STEPS.length-1)), 2200)
    try {
      const repoData = await fetchRepo(url.trim())
      setStepIdx(2)
      const result = await analyzeRepo(repoData)
      clearInterval(timer)
      setAnalysis({...result, repoData})
      setChatHistory([{role:'assistant',content:`I've analyzed **${repoData.owner}/${repoData.repo}**. ${result.summary} Ask me anything about how it's built.`,ts:Date.now()}])
      setVisited(new Set(['overview'])); setTab('overview'); setLessonsRead(new Set())
      setDdFile(result.keyFiles?.[0]?.path||''); setDdResult('')
      const entry = {owner:repoData.owner,repo:repoData.repo,url:url.trim(),ts:Date.now()}
      const updated = [entry,...recent.filter(h=>h.url!==url.trim())].slice(0,5)
      setRecent(updated); localStorage.setItem('sl_history', JSON.stringify(updated))
      if (user) saveAnalysis(user.uid, repoData.owner, repoData.repo, result.summary, result.techStack)
      window.history.pushState({},'',`?repo=${repoData.owner}/${repoData.repo}`)
      setPhase('lesson')
    } catch(e) { clearInterval(timer); setError(e.message); setPhase('home') }
  }

  function stopSpeaking() { speechSynthesis.cancel(); setSpeaking(false); setSpeakingId(null) }
  function listen(text, id) {
    if (speakingId === id) { stopSpeaking(); return }
    stopSpeaking(); setSpeaking(true); setSpeakingId(id)
    speakText(text, ()=>{ setSpeaking(false); setSpeakingId(null) })
  }

  async function sendChat(q) {
    const question = q || chatInput.trim()
    if (!question || chatLoading) return
    setChatInput('')
    setChatHistory(h=>[...h,{role:'user',content:question,ts:Date.now()}])
    setChatLoading(true)
    try {
      const ans = await chatWithRepo(question, analysis, chatHistory)
      setChatHistory(h=>[...h,{role:'assistant',content:ans,ts:Date.now()}])
    } catch(e) { setChatHistory(h=>[...h,{role:'assistant',content:'Error: '+e.message,ts:Date.now()}]) }
    setChatLoading(false)
  }

  async function handleDeepDive() {
    if (!ddFile||ddLoading) return
    setDdLoading(true); setDdResult('')
    try {
      const fc = analysis.repoData.files.find(f=>f.path===ddFile)?.content||''
      setDdResult(await deepDiveAI(ddFile, fc, ddQ))
    } catch(e) { setDdResult('Error: '+e.message) }
    setDdLoading(false)
  }

  function share() {
    navigator.clipboard.writeText(`${window.location.origin}/?repo=${analysis.repoData.owner}/${analysis.repoData.repo}`)
    showToast('🔗 Link copied to clipboard!')
  }

  const progress = Math.round((visited.size/NAV.length)*100)
  const unread = chatHistory.filter(m=>m.role==='assistant').length - 1


  // ── SETTINGS MODAL ──────────────────────────────────────────────
  function openSettings() {
    setSettingsGemini(getGeminiKey())
    setSettingsGroq(getGroqKey())
    setShowSettings(true)
  }
  function saveSettings() {
    if (settingsGemini.trim()) localStorage.setItem('sl_gemini_key', settingsGemini.trim())
    else localStorage.removeItem('sl_gemini_key')
    if (settingsGroq.trim()) localStorage.setItem('sl_groq_key', settingsGroq.trim())
    else localStorage.removeItem('sl_groq_key')
    setShowSettings(false)
    showToast('✓ API keys saved!')
  }
  const SettingsModal = showSettings ? (
    <div className="modal-overlay" onClick={()=>setShowSettings(false)}>
      <div className="modal-box glass" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">⚙ API Keys</div>
        <p className="modal-sub">Keys are saved in your browser only — never sent anywhere else.</p>
        <label className="modal-label">Gemini API Key</label>
        <input className="modal-input" type="password" placeholder="AIza..." value={settingsGemini} onChange={e=>setSettingsGemini(e.target.value)} autoComplete="off"/>
        <a className="modal-link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get a free Gemini key →</a>
        <label className="modal-label" style={{marginTop:'1rem'}}>Groq API Key (fallback)</label>
        <input className="modal-input" type="password" placeholder="gsk_..." value={settingsGroq} onChange={e=>setSettingsGroq(e.target.value)} autoComplete="off"/>
        <a className="modal-link" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a free Groq key →</a>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={()=>setShowSettings(false)}>Cancel</button>
          <button className="modal-save" onClick={saveSettings}>Save keys</button>
        </div>
      </div>
    </div>
  ) : null

  // ── LOADING ──────────────────────────────────────────────────────
  if (phase==='loading') return (
    <div className="load-screen">
      {SettingsModal}
      <div className="particles">{Array.from({length:20}).map((_,i)=><div key={i} className="particle" style={{'--i':i}}/>)}</div>
      <div className="load-card glass">
        <div className="load-eyebrow">Analyzing repository</div>
        <div className="load-repo">{url.replace('https://github.com/','')}</div>
        <div className="load-steps">
          {STEPS.map((s,i)=>(
            <div key={i} className={`load-step ${i<stepIdx?'done':i===stepIdx?'active':'pending'}`}>
              <div className="step-dot">{i<stepIdx?'✓':i===stepIdx?<span className="spin"/>:s.icon}</div>
              <div>
                <div className="step-label">{s.label}</div>
                {i===stepIdx&&<div className="step-sub">In progress...</div>}
                {i<stepIdx&&<div className="step-sub" style={{color:'var(--green)'}}>Complete</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="load-bar-wrap"><div className="load-bar" style={{width:`${(stepIdx+1)/STEPS.length*100}%`}}/></div>
        <div className="load-hint">Usually 15–30 seconds · Powered by Gemini AI</div>
      </div>
    </div>
  )

  // ── LESSON ───────────────────────────────────────────────────────
  if (phase==='lesson') return (
    <div className="lesson-page" data-theme={theme}>
      {SettingsModal}
      {toast&&<div className="toast">{toast}</div>}

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sb-brand">
          <span className="logo-mark">S</span>
          <div>
            <div className="logo-name">SysLearn</div>
            <div className="sb-repo">{analysis.repoData.owner}/{analysis.repoData.repo}</div>
          </div>
        </div>

        <div className="sb-stack">{analysis.techStack?.map(t=><span key={t} className="tech-pill">{t}</span>)}</div>

        <div className="sb-progress">
          <div className="sb-prog-top"><span>{visited.size}/{NAV.length} sections</span><span className="prog-pct">{progress}%</span></div>
          <div className="prog-track"><div className="prog-fill" style={{width:`${progress}%`}}/></div>
        </div>

        <nav className="sb-nav">
          {NAV.map(({id,icon,label})=>(
            <button key={id} className={`nav-btn${tab===id?' active':''}${visited.has(id)?' visited':''}`} onClick={()=>goTab(id)}>
              <span className="nav-ic">{icon}</span>
              <span className="nav-lbl">{label}</span>
              {id==='chat'&&unread>0&&<span className="nav-badge">{unread}</span>}
              {id==='lessons'&&lessonsRead.size>0&&<span className="nav-badge" style={{background:'var(--green)'}}>{lessonsRead.size}</span>}
            </button>
          ))}
        </nav>

        {recent.length>0&&(
          <div className="sb-recent">
            <div className="sb-recent-label">Recent</div>
            {recent.slice(0,4).map(r=>(
              <button key={r.url} className="recent-btn" onClick={()=>{setUrl(r.url);setPhase('home')}}>
                <span className="recent-repo">{r.owner}/{r.repo}</span>
                <span className="recent-time">{timeAgo(r.ts)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="sb-actions">
          <button className="sb-action-btn" onClick={share} title="Share">⬡</button>
          <button className="sb-action-btn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} title="Toggle theme">{theme==='dark'?'☀':'🌙'}</button>
          <button className="sb-action-btn" onClick={openSettings} title="API Keys">⚙</button>
          <button className="sb-action-btn new-btn" onClick={()=>{setPhase('home');setAnalysis(null);stopSpeaking();window.history.pushState({},'','/')}}>← New</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="lesson-main" ref={mainRef}>

        {/* OVERVIEW */}
        {tab==='overview'&&(
          <div className="tab-content fade-in">
            <div className="overview-hero">
              <div className="oh-left">
                <div className="oh-eyebrow">Repository Analysis</div>
                <h1 className="oh-title">{analysis.repoData.owner}/<span>{analysis.repoData.repo}</span></h1>
                <p className="oh-summary">{analysis.summary}</p>
                <div className="oh-stack">{analysis.techStack?.map(t=><span key={t} className="tech-badge">{t}</span>)}</div>
                <div className="oh-actions">
                  <button className="oh-btn primary" onClick={()=>goTab('architecture')}>Explore Architecture →</button>
                  <button className="oh-btn secondary" onClick={()=>goTab('chat')}>💬 Ask AI Mentor</button>
                  <button className={`oh-btn voice${speakingId==='summary'?' active':''}`} onClick={()=>listen(analysis.summary,'summary')}>{speakingId==='summary'?'⏸ Stop':'▶ Listen'}</button>
                </div>
              </div>
              <div className="oh-stats">
                <div className="stat-card glass">
                  <div className="stat-n">{analysis.components?.length||0}</div>
                  <div className="stat-l">Components</div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-n">{analysis.lessons?.length||0}</div>
                  <div className="stat-l">Lessons</div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-n">{analysis.codeSnippets?.length||0}</div>
                  <div className="stat-l">Code Snippets</div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-n">{analysis.repoData?.files?.length||0}</div>
                  <div className="stat-l">Files Analyzed</div>
                </div>
              </div>
            </div>

            <h2 className="sec-title">What you'll learn</h2>
            <div className="learn-grid">
              {NAV.slice(1).map(({id,icon,label})=>(
                <button key={id} className="learn-card glass" onClick={()=>goTab(id)}>
                  <span className="learn-ic">{icon}</span>
                  <span className="learn-label">{label}</span>
                  <span className="learn-arrow">→</span>
                </button>
              ))}
            </div>

            {analysis.gettingStarted&&(
              <>
                <h2 className="sec-title">Getting started</h2>
                <div className="getting-started glass">
                  <div className="gs-first">
                    <div className="gs-label">First step</div>
                    <p>{analysis.gettingStarted.firstStep}</p>
                  </div>
                  {analysis.gettingStarted.readingOrder?.length>0&&(
                    <div className="gs-reading">
                      <div className="gs-label">Reading order</div>
                      {analysis.gettingStarted.readingOrder.map((f,i)=>(
                        <div key={i} className="gs-file"><span className="gs-num">{i+1}</span><code style={{color:fileColor(f)}}>{f}</code></div>
                      ))}
                    </div>
                  )}
                  {analysis.gettingStarted.goodFirstIssues?.length>0&&(
                    <div className="gs-issues">
                      <div className="gs-label">Good first contributions</div>
                      {analysis.gettingStarted.goodFirstIssues.map((issue,i)=>(
                        <div key={i} className="gs-issue">✦ {issue}</div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ARCHITECTURE */}
        {tab==='architecture'&&(
          <div className="tab-content fade-in">
            <div className="tab-header">
              <div><h1>System Architecture</h1><p className="tab-sub">How this codebase is designed and why</p></div>
              <button className={`listen-btn${speakingId==='arch'?' on':''}`} onClick={()=>listen(analysis.architecture,'arch')}>{speakingId==='arch'?'⏸ Stop':'▶ Listen'}</button>
            </div>
            <div className="arch-summary glass">
              <div className="as-label">Overview</div>
              <p>{analysis.summary}</p>
            </div>
            <div className="arch-body">
              {analysis.architecture?.split('\n').filter(Boolean).map((p,i)=>(
                <p key={i} className="arch-p" style={{'--d':`${i*0.08}s`}}>{p}</p>
              ))}
            </div>
            <h2 className="sec-title">Components</h2>
            <div className="comp-grid">
              {analysis.components?.map((c,i)=>(
                <div key={c.name} className="comp-card glass" style={{'--d':`${i*0.06}s`}}>
                  <div className="cc-top">
                    <span className="cc-name">{c.name}</span>
                    {c.layer&&<span className="cc-layer" style={{background:layerColor(c.layer)+'18',color:layerColor(c.layer),border:`1px solid ${layerColor(c.layer)}28`}}>{c.layer}</span>}
                  </div>
                  <p className="cc-role">{c.role}</p>
                  {c.connects?.length>0&&(
                    <div className="cc-connects">
                      {c.connects.map(x=><span key={x} className="connect-pill" onClick={()=>{const el=document.querySelector(`[data-comp="${x}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'})}}>→ {x}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="arch-cta">
              <button className="cta-btn" onClick={()=>goTab('diagram')}>View Architecture Diagram →</button>
              <button className="cta-btn secondary" onClick={()=>goTab('lessons')}>Explore Design Lessons →</button>
            </div>
          </div>
        )}

        {/* DIAGRAM */}
        {tab==='diagram'&&(
          <div className="tab-content fade-in">
            <div className="tab-header">
              <div><h1>Architecture Diagram</h1><p className="tab-sub">Auto-generated from the actual code</p></div>
              <div className="zoom-row">
                <button className="zoom-btn" onClick={()=>setDiagramScale(s=>Math.max(0.3,s-0.15))}>−</button>
                <span className="zoom-val">{Math.round(diagramScale*100)}%</span>
                <button className="zoom-btn" onClick={()=>setDiagramScale(1)}>⊙</button>
                <button className="zoom-btn" onClick={()=>setDiagramScale(s=>Math.min(3,s+0.15))}>+</button>
              </div>
            </div>
            <div className="diag-panel glass">
              {diagramSvg
                ? <div className="diag-inner" style={{transform:`scale(${diagramScale})`,transformOrigin:'top center',transition:'transform 0.2s'}} dangerouslySetInnerHTML={{__html:diagramSvg}}/>
                : <div className="diag-empty"><div className="spin-lg"/><p>Rendering diagram...</p></div>
              }
            </div>
            <div className="diag-tip glass">
              <span>💡</span>
              <span>Use the zoom controls to navigate large diagrams. Each node represents a component from the codebase.</span>
            </div>
          </div>
        )}

        {/* LESSONS */}
        {tab==='lessons'&&(
          <div className="tab-content fade-in">
            <div className="tab-header">
              <div>
                <h1>System Design Lessons</h1>
                <p className="tab-sub">{lessonsRead.size} of {analysis.lessons?.length||0} lessons read</p>
              </div>
              <button className={`listen-btn${speakingId==='all-lessons'?' on':''}`} onClick={()=>listen(analysis.lessons?.map(l=>`${l.title}. ${l.explanation}`).join('. '),'all-lessons')}>{speakingId==='all-lessons'?'⏸ Stop':'▶ Play all'}</button>
            </div>
            <div className="lessons-progress-bar"><div style={{width:`${analysis.lessons?.length?lessonsRead.size/analysis.lessons.length*100:0}%`}}/></div>
            <div className="lessons-list">
              {analysis.lessons?.map((l,i)=>{
                const isOpen = expanded===i
                const isRead = lessonsRead.has(i)
                return (
                  <div key={i} className={`lesson-card glass${isOpen?' open':''}${isRead?' read':''}`}>
                    <button className="lesson-trigger" onClick={()=>{setExpanded(isOpen?null:i);setLessonsRead(r=>new Set([...r,i]))}}>
                      <span className="lesson-num">{String(i+1).padStart(2,'0')}</span>
                      <div className="lesson-title-wrap">
                        <span className="lesson-title">{l.title}</span>
                        <div className="lesson-tags">
                          {l.pattern&&<span className="pattern-tag">{l.pattern}</span>}
                          {l.difficulty&&<span className={`diff-tag ${l.difficulty}`}>{l.difficulty}</span>}
                          {isRead&&<span className="read-tag">✓ read</span>}
                        </div>
                      </div>
                      <span className="lesson-chevron">{isOpen?'−':'+'}</span>
                    </button>
                    <div className="lesson-body">
                      <p className="lesson-exp">{l.explanation}</p>
                      {l.realWorldUse&&<div className="lesson-rw"><span>🌍</span><span>{l.realWorldUse}</span></div>}
                      <div className="lesson-actions">
                        <button className={`mini-btn${speakingId==='l'+i?' on':''}`} onClick={()=>listen(`${l.title}. ${l.explanation}. ${l.realWorldUse||''}`, 'l'+i)}>{speakingId==='l'+i?'⏸ Stop':'▶ Listen'}</button>
                        <button className="mini-btn" onClick={()=>sendChat(`Tell me more about ${l.title} in this codebase`)}>Ask AI →</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CODE SNIPPETS */}
        {tab==='snippets'&&(
          <div className="tab-content fade-in">
            <div className="tab-header"><div><h1>Code Snippets</h1><p className="tab-sub">Real code showing system design concepts in action</p></div></div>
            {analysis.codeSnippets?.length ? (
              <div className="snippets-list">
                {analysis.codeSnippets.map((s,i)=>(
                  <div key={i} className="snippet-card glass">
                    <div className="snip-header">
                      <div>
                        <div className="snip-title">{s.title}</div>
                        <div className="snip-meta">
                          <code className="snip-file" style={{color:fileColor(s.file)}}>{s.file}</code>
                          <span className="concept-tag">{s.concept}</span>
                        </div>
                      </div>
                      <button className={`mini-btn${speakingId==='s'+i?' on':''}`} onClick={()=>listen(`${s.title}. ${s.explanation}. ${s.whyItMatters||''}`, 's'+i)}>{speakingId==='s'+i?'⏸':'▶'}</button>
                    </div>
                    <pre className="code-block"><code>{s.code}</code></pre>
                    <p className="snip-exp">{s.explanation}</p>
                    {s.whyItMatters&&<div className="snip-why"><span>💡</span><span>{s.whyItMatters}</span></div>}
                    <button className="mini-btn" style={{marginTop:'0.75rem'}} onClick={()=>{goTab('chat');sendChat(`Explain this code pattern from ${s.file}: ${s.concept}`)}}>Ask AI about this →</button>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state glass"><p>No code snippets were extracted. Try re-analyzing the repository.</p></div>}
          </div>
        )}

        {/* CONCEPTS */}
        {tab==='concepts'&&(
          <div className="tab-content fade-in">
            <div className="tab-header"><div><h1>System Design Concepts</h1><p className="tab-sub">Key engineering concepts demonstrated in this codebase</p></div></div>
            {analysis.systemDesignConcepts?.length ? (
              <div className="concepts-grid">
                {analysis.systemDesignConcepts.map((c,i)=>(
                  <div key={i} className="concept-card glass">
                    <div className="concept-name">{c.concept}</div>
                    <p className="concept-how">{c.howUsedHere}</p>
                    {c.learnMore&&<div className="concept-learn"><span>→</span><span>{c.learnMore}</span></div>}
                    <button className="mini-btn" style={{marginTop:'0.75rem'}} onClick={()=>sendChat(`Explain ${c.concept} as used in this codebase`)}>Deep dive →</button>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state glass"><p>Re-analyze the repo to extract system design concepts.</p></div>}
          </div>
        )}

        {/* DEEP DIVE */}
        {tab==='deepdive'&&(
          <div className="tab-content fade-in">
            <div className="tab-header"><div><h1>Deep Dive</h1><p className="tab-sub">AI-powered analysis of any specific file</p></div></div>
            <div className="dd-form glass">
              <div className="dd-row">
                <label>Select a file to analyze</label>
                <select className="dd-select" value={ddFile} onChange={e=>setDdFile(e.target.value)}>
                  {analysis.repoData?.files?.map(f=><option key={f.path} value={f.path}>{f.path}</option>)}
                </select>
              </div>
              <div className="dd-row">
                <label>Your question <span className="dd-opt">(optional)</span></label>
                <input className="dd-input" placeholder="e.g. How does error handling work? What design pattern is used?" value={ddQ} onChange={e=>setDdQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleDeepDive()}/>
              </div>
              <button className="dd-submit" onClick={handleDeepDive} disabled={ddLoading}>
                {ddLoading?<><span className="spin"/>Analyzing...</>:'🔍 Analyze this file →'}
              </button>
            </div>
            {ddResult&&(
              <div className="dd-result glass fade-in">
                <div className="dd-result-file" style={{color:fileColor(ddFile)}}>{ddFile}</div>
                <p className="dd-result-text">{ddResult}</p>
                <div className="dd-result-actions">
                  <button className={`mini-btn${speakingId==='dd'?' on':''}`} onClick={()=>listen(ddResult,'dd')}>{speakingId==='dd'?'⏸ Stop':'▶ Listen'}</button>
                  <button className="mini-btn" onClick={()=>{goTab('chat');sendChat(`Tell me more about ${ddFile}`)}}>Continue in chat →</button>
                </div>
              </div>
            )}
            <h2 className="sec-title" style={{marginTop:'2rem'}}>Pre-analyzed Deep Dives</h2>
            <div className="lessons-list">
              {analysis.deepDive?.map((d,i)=>(
                <div key={i} className={`lesson-card glass${expanded==='dd'+i?' open':''}`}>
                  <button className="lesson-trigger" onClick={()=>setExpanded(expanded==='dd'+i?null:'dd'+i)}>
                    <span className="lesson-num">{String(i+1).padStart(2,'0')}</span>
                    <span className="lesson-title">{d.topic}</span>
                    <span className="lesson-chevron">{expanded==='dd'+i?'−':'+'}</span>
                  </button>
                  <div className="lesson-body">
                    <p className="lesson-exp">{d.content}</p>
                    {d.keyFiles?.length>0&&<div className="dd-files">{d.keyFiles.map(f=><code key={f} style={{color:fileColor(f)}}>{f}</code>)}</div>}
                    <div className="lesson-actions">
                      <button className={`mini-btn${speakingId==='ddi'+i?' on':''}`} onClick={()=>listen(`${d.topic}. ${d.content}`,'ddi'+i)}>{speakingId==='ddi'+i?'⏸':'▶'} Listen</button>
                      <button className="mini-btn" onClick={()=>sendChat(`Explain more about ${d.topic}`)}>Ask AI →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTRIBUTOR GUIDE */}
        {tab==='guide'&&(
          <div className="tab-content fade-in">
            <div className="tab-header">
              <div><h1>Contributor Guide</h1><p className="tab-sub">Everything you need to contribute to this codebase</p></div>
              <button className={`listen-btn${speakingId==='guide'?' on':''}`} onClick={()=>listen(analysis.contributorGuide,'guide')}>{speakingId==='guide'?'⏸ Stop':'▶ Listen'}</button>
            </div>
            <div className="arch-body">{analysis.contributorGuide?.split('\n').filter(Boolean).map((p,i)=><p key={i} className="arch-p">{p}</p>)}</div>
            <h2 className="sec-title">Key files</h2>
            <div className="file-tree">
              {analysis.keyFiles?.map(f=>(
                <div key={f.path} className="file-row glass" onClick={()=>{setDdFile(f.path);goTab('deepdive')}}>
                  <div className="file-dot" style={{background:fileColor(f.path)}}/>
                  <div className="file-info">
                    <code className="file-name" style={{color:fileColor(f.path)}}>{f.path}</code>
                    <span className="file-purpose">{f.purpose}</span>
                  </div>
                  <span className="file-arrow">→</span>
                </div>
              ))}
            </div>
            {analysis.gettingStarted?.setupCommands?.length>0&&(
              <>
                <h2 className="sec-title">Setup commands</h2>
                <div className="setup-commands glass">
                  {analysis.gettingStarted.setupCommands.map((cmd,i)=>(
                    <div key={i} className="setup-cmd">
                      <code>{cmd}</code>
                      <button className="copy-btn" onClick={()=>{navigator.clipboard.writeText(cmd);showToast('Copied!')}}>copy</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* CHAT */}
        {tab==='chat'&&(
          <div className="chat-page fade-in">
            <div className="chat-header">
              <div><h1>Chat Tutor</h1><p className="tab-sub">Ask anything about {analysis.repoData.owner}/{analysis.repoData.repo}</p></div>
            </div>
            <div className="chat-msgs">
              {chatHistory.map((m,i)=>(
                <div key={i} className={`msg-wrap ${m.role}`}>
                  <div className="msg-av">{m.role==='user'?'You':'AI'}</div>
                  <div className="msg-bubble">
                    <div className="msg-text">{m.content.split('**').map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}</div>
                    <div className="msg-meta">
                      <span className="msg-time">{timeAgo(m.ts)}</span>
                      {m.role==='assistant'&&<>
                        <button className="msg-act" onClick={()=>navigator.clipboard.writeText(m.content)}>copy</button>
                        <button className={`msg-act${speakingId==='m'+i?' on':''}`} onClick={()=>listen(m.content,'m'+i)}>{speakingId==='m'+i?'⏸':'▶'}</button>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading&&<div className="msg-wrap assistant"><div className="msg-av">AI</div><div className="msg-bubble"><div className="typing"><span/><span/><span/></div></div></div>}
              <div ref={chatEndRef}/>
            </div>
            {chatHistory.length<=1&&(
              <div className="chat-chips">
                {['How does the architecture work?','What design patterns are used?','How do I start contributing?','Explain the data flow','What are the key files?','How is error handling done?'].map(s=>(
                  <button key={s} className="chip" onClick={()=>sendChat(s)}>{s}</button>
                ))}
              </div>
            )}
            <div className="chat-input-bar">
              <textarea className="chat-ta" rows={1} placeholder="Ask about architecture, patterns, files, how to contribute..." value={chatInput}
                onChange={e=>{setChatInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}}/>
              <button className="chat-send-btn" onClick={()=>sendChat()} disabled={chatLoading}>{chatLoading?<span className="spin"/>:'↑'}</button>
            </div>
          </div>
        )}

      </main>
    </div>
  )

  // ── HOME ─────────────────────────────────────────────────────────
  return (
    <div className="home-page" data-theme={theme}>
      {SettingsModal}
      <div className="home-bg"><div className="bg-grid"/><div className="bg-glow g1"/><div className="bg-glow g2"/></div>

      <header className="home-header">
        <div className="header-brand"><span className="logo-mark">S</span><span className="logo-name">SysLearn</span></div>
        <div className="header-right">
          <button className="icon-btn" onClick={openSettings} title="API Keys">⚙</button>
          <button className="icon-btn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'☀':'🌙'}</button>
          {authLoading
            ? <div className="auth-skeleton"/>
            : user
              ? <div className="user-chip">
                  <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer"/>
                  <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                  <button className="signout" onClick={signOut}>Sign out</button>
                </div>
              : <button className="signin-btn" onClick={signInWithGoogle}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Sign in with Google
                </button>
          }
        </div>
      </header>

      <section className="home-hero">
        <div className="hero-badge">Open-source · Free · No setup required</div>
        <h1 className="hero-h1">Learn system design<br/>from <em>real codebases</em></h1>
        <p className="hero-sub">Paste any GitHub URL. Get an interactive lesson with architecture diagrams, voice walkthrough, design pattern analysis, code snippets, and an AI mentor — all generated from the actual source code.</p>

        <div className={`url-wrap glass${error?' has-error':''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="url-icon"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          <input className="url-field" placeholder="https://github.com/expressjs/express" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAnalyze()}/>
          <button className="analyze-btn" onClick={handleAnalyze} title={!user?'Sign in to analyze':''}>
            {!user?'Sign in to analyze':'Analyze →'}
          </button>
        </div>
        {error&&<div className="home-error">⚠ {error}</div>}

        <div className="try-row">
          <span className="try-label">Try:</span>
          {['facebook/react','expressjs/express','tiangolo/fastapi','django/django','vercel/next.js'].map(r=>(
            <button key={r} className="try-pill" onClick={()=>setUrl(`https://github.com/${r}`)}>{r}</button>
          ))}
        </div>

        {recent.length>0&&(
          <div className="recent-section">
            <div className="recent-header">Recently analyzed</div>
            <div className="recent-list">
              {recent.map(r=>(
                <button key={r.url} className="recent-card glass" onClick={()=>setUrl(r.url)}>
                  <span className="rc-repo">{r.owner}/{r.repo}</span>
                  <span className="rc-time">{timeAgo(r.ts)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="how-section">
        <h2 className="section-heading centered">How it works</h2>
        <div className="how-grid">
          {[{n:'01',t:'Paste any GitHub URL',d:'Public repositories only. No cloning, no setup, no account needed.'},
            {n:'02',t:'AI reads the important files',d:'Smart file ranker picks the top 10 most important files and sends them to Gemini AI.'},
            {n:'03',t:'Get a full interactive lesson',d:'Architecture diagram, voice narration, design lessons, code snippets, and a chat tutor — all in seconds.'}
          ].map((s,i)=>(
            <div key={i} className="how-card glass">
              <div className="how-num">{s.n}</div>
              <div className="how-title">{s.t}</div>
              <div className="how-desc">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="features-section">
        <h2 className="section-heading centered">Everything you get</h2>
        <div className="features-grid">
          {[
            ['🏠','Overview dashboard','Stats, getting started guide, reading order, and good first issues in one place.'],
            ['🏛','Architecture analysis','5-paragraph breakdown of patterns, data flow, design decisions, and scalability.'],
            ['🗺','Live diagram','Auto-generated Mermaid flowchart with zoom controls from the actual codebase.'],
            ['📚','Design lessons','Real patterns with difficulty levels, real-world examples, and voice narration.'],
            ['💻','Code snippets','Exact code showing how Redis, auth, middleware, caching are actually built.'],
            ['🧠','System design concepts','Key engineering concepts like SOLID, DI, event-driven, explained in context.'],
            ['🔍','Deep dive','Pick any file. Ask a question. Get a senior engineer-level explanation.'],
            ['🗂','Contributor guide','Reading order, setup commands, key files, and good first contribution ideas.'],
            ['💬','AI chat tutor','Ask anything. Get answers grounded in the real source code, not generic theory.'],
          ].map(([ic,t,d])=>(
            <div key={t} className="feat glass">
              <div className="feat-icon">{ic}</div>
              <div className="feat-title">{t}</div>
              <div className="feat-desc">{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
