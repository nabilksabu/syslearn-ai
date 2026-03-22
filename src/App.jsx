import { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { fetchRepo } from './lib/github'
import { analyzeRepo, chatWithRepo, deepDive } from './lib/ai'
import { auth, signInWithGoogle, signOut, onAuthStateChanged, saveAnalysis, getRecentAnalyses } from './lib/firebase'
import './App.css'

mermaid.initialize({
  startOnLoad: false, theme: 'dark',
  themeVariables: {
    primaryColor: '#1e2d4a', primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#2d4a7a', lineColor: '#4a9eff',
    background: '#080c14', mainBkg: '#0f1829',
    nodeBorder: '#2d4a7a', titleColor: '#4a9eff',
    edgeLabelBackground: '#0f1829',
    fontFamily: 'JetBrains Mono, monospace', fontSize: '13px'
  }
})

function getBestVoice() {
  const vs = speechSynthesis.getVoices()
  const pref = ['Google UK English Male','Google UK English Female','Google US English','Microsoft David','Alex','Daniel']
  for (const n of pref) { const v = vs.find(x => x.name.includes(n)); if (v) return v }
  return vs.find(v => v.lang?.startsWith('en')) || null
}

function speakText(text, onEnd) {
  if (!window.speechSynthesis) return
  speechSynthesis.cancel()
  const chunks = text.match(/.{1,220}(?:\s|$)/g) || [text]
  let i = 0
  const next = () => {
    if (i >= chunks.length) { onEnd?.(); return }
    const u = new SpeechSynthesisUtterance(chunks[i++])
    u.voice = getBestVoice(); u.rate = 0.9; u.pitch = 1; u.volume = 1
    u.onend = next; u.onerror = next
    speechSynthesis.speak(u)
  }
  if (!speechSynthesis.getVoices().length) speechSynthesis.onvoiceschanged = next
  else next()
}

function sanitizeMermaid(code) {
  if (!code) return ''
  let c = code.replace(/```mermaid\n?|```\n?/g, '').trim()
  c = c.replace(/\[([^\]]*)\]/g, (_, inner) => '[' + inner.replace(/[^\w\s\-/.]/g, '').trim() + ']')
  return c
}

function fileColor(p) {
  if (/\.(js|jsx|ts|tsx)$/.test(p)) return '#4a9eff'
  if (/\.py$/.test(p)) return '#34d399'
  if (/\.(md|txt)$/.test(p)) return '#94a3b8'
  if (/\.(json|yaml|yml|toml)$/.test(p)) return '#fb923c'
  if (/\.(css|scss)$/.test(p)) return '#f472b6'
  if (/\.(go|rs|java|rb)$/.test(p)) return '#a78bfa'
  return '#64748b'
}

function layerColor(l) {
  return { api:'#4a9eff', data:'#34d399', ui:'#a78bfa', infra:'#fb923c', util:'#64748b' }[l] || '#64748b'
}

function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

const LOAD_STEPS = [
  { icon:'⬡', label:'Fetching repository tree' },
  { icon:'◈', label:'Scoring and selecting key files' },
  { icon:'◉', label:'Sending to AI' },
  { icon:'⊕', label:'Building architecture map' },
  { icon:'▶', label:'Preparing your lesson' },
]

const NAV = [
  { id:'architecture', icon:'🏛', label:'Architecture' },
  { id:'diagram',      icon:'🗺', label:'Diagram' },
  { id:'lessons',      icon:'📚', label:'Lessons' },
  { id:'snippets',     icon:'💻', label:'Code Snippets' },
  { id:'deepdive',     icon:'🔍', label:'Deep Dive' },
  { id:'code',         icon:'🗂', label:'Code Guide' },
  { id:'chat',         icon:'💬', label:'Chat Tutor' },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('sl_theme') || 'dark')
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
  const [diagramScale, setDiagramScale] = useState(1)
  const [expandedLesson, setExpandedLesson] = useState(null)
  const [visitedTabs, setVisitedTabs] = useState(new Set(['architecture']))
  const [recentList, setRecentList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sl_history') || '[]') } catch { return [] }
  })
  const [ddFile, setDdFile] = useState('')
  const [ddQuestion, setDdQuestion] = useState('')
  const [ddResult, setDdResult] = useState('')
  const [ddLoading, setDdLoading] = useState(false)
  const [toast, setToast] = useState('')
  const chatEndRef = useRef(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false) })
    return unsub
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sl_theme', theme)
  }, [theme])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('repo')
    if (p) setUrl(`https://github.com/${p}`)
  }, [])

  useEffect(() => {
    if (analysis?.mermaid) renderDiagram(analysis.mermaid)
  }, [analysis])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    if (user) {
      getRecentAnalyses(user.uid).then(data => {
        if (data.length) setRecentList(data)
      })
    }
  }, [user])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function renderDiagram(code) {
    const clean = sanitizeMermaid(code)
    try {
      const { svg } = await mermaid.render('diag-' + Date.now(), clean)
      setDiagramSvg(svg)
    } catch {
      if (analysis?.components?.length) {
        const nodes = analysis.components.map(c => `  ${c.name.replace(/\W/g,'')}[${c.name}]`).join('\n')
        const edges = analysis.components.flatMap(c =>
          (c.connects||[]).map(x => `  ${c.name.replace(/\W/g,'')} --> ${x.replace(/\W/g,'')}`)
        ).join('\n')
        try {
          const { svg } = await mermaid.render('fb-' + Date.now(), `flowchart TD\n${nodes}\n${edges}`)
          setDiagramSvg(svg)
          return
        } catch {}
      }
      setDiagramSvg('<p class="diag-err">Could not render diagram. Try re-analyzing.</p>')
    }
  }

  function visitTab(id) {
    setActiveTab(id)
    setVisitedTabs(v => new Set([...v, id]))
  }

  async function handleAnalyze() {
    if (!url.trim()) return
    if (!user) { setError('Sign in with Google to analyze repos.'); return }
    setError(null); setPhase('loading'); setStepIdx(0)
    const timer = setInterval(() => setStepIdx(i => Math.min(i + 1, LOAD_STEPS.length - 1)), 2200)
    try {
      const repoData = await fetchRepo(url.trim())
      setStepIdx(2)
      const result = await analyzeRepo(repoData)
      clearInterval(timer)
      const full = { ...result, repoData }
      setAnalysis(full)
      setChatHistory([{
        role: 'assistant',
        content: `I've analyzed **${repoData.owner}/${repoData.repo}**. ${result.summary} Ask me anything about how it's built.`,
        ts: Date.now()
      }])
      setVisitedTabs(new Set(['architecture']))
      setActiveTab('architecture')
      setDdFile(result.keyFiles?.[0]?.path || '')
      setDdResult('')
      const entry = { owner: repoData.owner, repo: repoData.repo, url: url.trim(), ts: Date.now() }
      const updated = [entry, ...recentList.filter(h => h.url !== url.trim())].slice(0, 5)
      setRecentList(updated)
      localStorage.setItem('sl_history', JSON.stringify(updated))
      if (user) saveAnalysis(user.uid, repoData.owner, repoData.repo, result.summary, result.techStack)
      window.history.pushState({}, '', `?repo=${repoData.owner}/${repoData.repo}`)
      setPhase('lesson')
    } catch (e) {
      clearInterval(timer)
      setError(e.message)
      setPhase('home')
    }
  }

  function stopSpeaking() { speechSynthesis.cancel(); setSpeaking(false) }

  function listen(text) {
    if (speaking) { stopSpeaking(); return }
    setSpeaking(true)
    speakText(text, () => setSpeaking(false))
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return
    const q = chatInput.trim()
    setChatInput('')
    setChatHistory(h => [...h, { role:'user', content:q, ts:Date.now() }])
    setChatLoading(true)
    try {
      const ans = await chatWithRepo(q, analysis, chatHistory)
      setChatHistory(h => [...h, { role:'assistant', content:ans, ts:Date.now() }])
    } catch (e) {
      setChatHistory(h => [...h, { role:'assistant', content:'Error: '+e.message, ts:Date.now() }])
    }
    setChatLoading(false)
  }

  async function handleDeepDive() {
    if (!ddFile || ddLoading) return
    setDdLoading(true); setDdResult('')
    try {
      const fc = analysis.repoData.files.find(f => f.path === ddFile)?.content || ''
      setDdResult(await deepDive(ddFile, fc, ddQuestion))
    } catch (e) { setDdResult('Error: ' + e.message) }
    setDdLoading(false)
  }

  function shareRepo() {
    const link = `${window.location.origin}/?repo=${analysis.repoData.owner}/${analysis.repoData.repo}`
    navigator.clipboard.writeText(link)
    showToast('🔗 Link copied!')
  }

  const progress = Math.round((visitedTabs.size / NAV.length) * 100)

  // ── LOADING ──────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="loading-screen">
      <div className="particles">{Array.from({length:20}).map((_,i)=><div key={i} className="particle" style={{'--i':i}}/>)}</div>
      <div className="load-card glass">
        <div className="load-eyebrow">Analyzing</div>
        <div className="load-repo">{url.replace('https://github.com/','')}</div>
        <div className="load-steps">
          {LOAD_STEPS.map((s,i)=>(
            <div key={i} className={`load-step ${i<stepIdx?'done':i===stepIdx?'active':'pending'}`}>
              <div className="step-dot">
                {i<stepIdx?'✓':i===stepIdx?<span className="spin"/>:s.icon}
              </div>
              <span className="step-lbl">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="load-track"><div className="load-fill" style={{width:`${(stepIdx+1)/LOAD_STEPS.length*100}%`}}/></div>
        <div className="load-hint">Usually 15–30 seconds</div>
      </div>
    </div>
  )

  // ── LESSON ───────────────────────────────────────────────────────
  if (phase === 'lesson') return (
    <div className="lesson-wrap" data-theme={theme}>
      {toast && <div className="toast">{toast}</div>}

      <aside className="sidebar">
        <div className="sb-logo"><span className="logo-mark">S</span><span className="logo-name">SysLearn</span></div>

        <div className="sb-repo-block">
          <div className="sb-repo-name">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            {analysis.repoData.owner}/{analysis.repoData.repo}
          </div>
          <div className="sb-stack">{analysis.techStack?.map(t=><span key={t} className="tech-pill">{t}</span>)}</div>
        </div>

        <div className="sb-prog-block">
          <div className="sb-prog-row"><span>{visitedTabs.size}/{NAV.length} explored</span><span>{progress}%</span></div>
          <div className="sb-prog-bar"><div style={{width:`${progress}%`}}/></div>
        </div>

        <nav className="sb-nav">
          {NAV.map(({id,icon,label})=>(
            <button key={id} className={`nav-btn ${activeTab===id?'active':''} ${visitedTabs.has(id)?'visited':''}`} onClick={()=>visitTab(id)}>
              <span className="nav-ic">{icon}</span>
              <span className="nav-lbl">{label}</span>
              {id==='chat'&&chatHistory.length>1&&<span className="nav-badge">{chatHistory.length-1}</span>}
            </button>
          ))}
        </nav>

        {recentList.length>0 && (
          <div className="sb-recent">
            <div className="sb-recent-lbl">Recent</div>
            {recentList.slice(0,4).map(r=>(
              <button key={r.url} className="recent-btn" onClick={()=>{setUrl(r.url);setPhase('home')}}>
                <span className="recent-name">{r.owner}/{r.repo}</span>
                <span className="recent-ts">{timeAgo(r.ts)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="sb-foot">
          <button className="sb-btn" onClick={shareRepo}>⬡ Share</button>
          <button className="sb-btn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'☀':'🌙'}</button>
          <button className="sb-btn" onClick={()=>{setPhase('home');setAnalysis(null);stopSpeaking();window.history.pushState({},'','/')}}>← New</button>
        </div>
      </aside>

      <main className="lesson-main">

        {activeTab==='architecture'&&(
          <div className="tab-pane fade-in">
            <div className="tab-head">
              <div><h1>System Architecture</h1><p className="tab-sub">How this codebase is designed and why</p></div>
              <button className={`listen-btn${speaking?' on':''}`} onClick={()=>listen(analysis.architecture)}>{speaking?'⏸ Stop':'▶ Listen'}</button>
            </div>
            <div className="summary-card glass">
              <div className="card-eye">Overview</div>
              <p>{analysis.summary}</p>
            </div>
            <div className="arch-body">
              {analysis.architecture?.split('\n').filter(Boolean).map((p,i)=>(
                <p key={i} className="arch-p" style={{'--d':`${i*0.07}s`}}>{p}</p>
              ))}
            </div>
            <h2 className="sec-label">Components</h2>
            <div className="comp-grid">
              {analysis.components?.map((c,i)=>(
                <div key={c.name} className="comp-card glass" style={{'--d':`${i*0.06}s`}}>
                  <div className="comp-top">
                    <span className="comp-name">{c.name}</span>
                    {c.layer&&<span className="layer-tag" style={{background:layerColor(c.layer)+'18',color:layerColor(c.layer),border:`1px solid ${layerColor(c.layer)}30`}}>{c.layer}</span>}
                  </div>
                  <p className="comp-role">{c.role}</p>
                  {c.connects?.length>0&&<div className="comp-links">{c.connects.map(x=><span key={x} className="link-tag">→ {x}</span>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==='diagram'&&(
          <div className="tab-pane fade-in">
            <div className="tab-head">
              <div><h1>Architecture Diagram</h1><p className="tab-sub">Auto-generated from the codebase</p></div>
              <div className="zoom-btns">
                <button onClick={()=>setDiagramScale(s=>Math.max(0.3,s-0.15))}>−</button>
                <button onClick={()=>setDiagramScale(1)}>⊙</button>
                <button onClick={()=>setDiagramScale(s=>Math.min(2.5,s+0.15))}>+</button>
              </div>
            </div>
            <div className="diag-panel glass">
              <div style={{transform:`scale(${diagramScale})`,transformOrigin:'top center',transition:'transform 0.2s'}} dangerouslySetInnerHTML={{__html:diagramSvg}}/>
            </div>
          </div>
        )}

        {activeTab==='lessons'&&(
          <div className="tab-pane fade-in">
            <div className="tab-head">
              <div><h1>System Design Lessons</h1><p className="tab-sub">Real patterns from this codebase</p></div>
              <button className={`listen-btn${speaking?' on':''}`} onClick={()=>listen(analysis.lessons?.map(l=>`${l.title}. ${l.explanation}`).join('. '))}>{speaking?'⏸ Stop':'▶ Play all'}</button>
            </div>
            <div className="lessons-list">
              {analysis.lessons?.map((l,i)=>(
                <div key={i} className={`lesson-item glass${expandedLesson===i?' open':''}`}>
                  <button className="lesson-btn" onClick={()=>setExpandedLesson(expandedLesson===i?null:i)}>
                    <span className="lesson-n">{String(i+1).padStart(2,'0')}</span>
                    <span className="lesson-title">{l.title}</span>
                    <div className="lesson-right">
                      {l.pattern&&<span className="pat-tag">{l.pattern}</span>}
                      <span className="chevron">{expandedLesson===i?'−':'+'}</span>
                    </div>
                  </button>
                  <div className="lesson-body">
                    <p>{l.explanation}</p>
                    <button className="mini-listen" onClick={()=>listen(`${l.title}. ${l.explanation}`)}>▶ Listen</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==='snippets'&&(
          <div className="tab-pane fade-in">
            <div className="tab-head"><div><h1>Code Snippets</h1><p className="tab-sub">Actual code showing system design concepts in action</p></div></div>
            <div className="snippets-list">
              {analysis.codeSnippets?.length ? analysis.codeSnippets.map((s,i)=>(
                <div key={i} className="snip-card glass">
                  <div className="snip-head">
                    <div>
                      <div className="snip-title">{s.title}</div>
                      <div className="snip-meta">
                        <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:fileColor(s.file)}}>{s.file}</span>
                        <span className="concept-tag">{s.concept}</span>
                      </div>
                    </div>
                    <button className="mini-listen" onClick={()=>listen(s.explanation)}>▶</button>
                  </div>
                  <pre className="code-block"><code>{s.code}</code></pre>
                  <p className="snip-exp">{s.explanation}</p>
                </div>
              )) : <div className="glass" style={{padding:'2rem',textAlign:'center',color:'var(--muted)',fontSize:'0.88rem'}}>No snippets extracted. Try re-analyzing.</div>}
            </div>
          </div>
        )}

        {activeTab==='deepdive'&&(
          <div className="tab-pane fade-in">
            <div className="tab-head"><div><h1>Deep Dive</h1><p className="tab-sub">AI analysis of a specific file</p></div></div>
            <div className="dd-form glass">
              <div className="dd-field">
                <label>File to analyze</label>
                <select className="dd-select" value={ddFile} onChange={e=>setDdFile(e.target.value)}>
                  {analysis.repoData?.files?.map(f=><option key={f.path} value={f.path}>{f.path}</option>)}
                </select>
              </div>
              <div className="dd-field">
                <label>Question <span>(optional)</span></label>
                <input className="dd-input" placeholder="e.g. How does middleware chaining work?" value={ddQuestion} onChange={e=>setDdQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleDeepDive()}/>
              </div>
              <button className="dd-btn" onClick={handleDeepDive} disabled={ddLoading}>
                {ddLoading?<span className="spin"/>:'🔍 Dive Deep →'}
              </button>
            </div>
            {ddResult&&(
              <div className="dd-result glass fade-in">
                <div style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:fileColor(ddFile),marginBottom:'0.75rem'}}>{ddFile}</div>
                <p style={{fontSize:'0.88rem',color:'var(--muted2)',lineHeight:1.75}}>{ddResult}</p>
                <button className="mini-listen" style={{marginTop:'0.75rem'}} onClick={()=>listen(ddResult)}>▶ Listen</button>
              </div>
            )}
            <h2 className="sec-label" style={{marginTop:'2rem'}}>Pre-analyzed Deep Dives</h2>
            <div className="lessons-list">
              {analysis.deepDive?.map((d,i)=>(
                <div key={i} className={`lesson-item glass${expandedLesson==='dd'+i?' open':''}`}>
                  <button className="lesson-btn" onClick={()=>setExpandedLesson(expandedLesson==='dd'+i?null:'dd'+i)}>
                    <span className="lesson-n">{String(i+1).padStart(2,'0')}</span>
                    <span className="lesson-title">{d.topic}</span>
                    <span className="chevron">{expandedLesson==='dd'+i?'−':'+'}</span>
                  </button>
                  <div className="lesson-body"><p>{d.content}</p><button className="mini-listen" onClick={()=>listen(`${d.topic}. ${d.content}`)}>▶ Listen</button></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==='code'&&(
          <div className="tab-pane fade-in">
            <div className="tab-head">
              <div><h1>Contributor Guide</h1><p className="tab-sub">How to navigate and contribute to this repo</p></div>
              <button className={`listen-btn${speaking?' on':''}`} onClick={()=>listen(analysis.contributorGuide)}>{speaking?'⏸ Stop':'▶ Listen'}</button>
            </div>
            <div className="arch-body">{analysis.contributorGuide?.split('\n').filter(Boolean).map((p,i)=><p key={i} className="arch-p">{p}</p>)}</div>
            <h2 className="sec-label">Key Files</h2>
            <div className="file-tree">
              {analysis.keyFiles?.map(f=>(
                <div key={f.path} className="file-row">
                  <span className="file-dot" style={{background:fileColor(f.path)}}/>
                  <div><code style={{fontFamily:'var(--mono)',fontSize:'0.76rem',color:fileColor(f.path)}}>{f.path}</code><span className="file-purp">{f.purpose}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==='chat'&&(
          <div className="tab-pane chat-pane fade-in">
            <div className="tab-head" style={{padding:'1.75rem 2rem 1.25rem',borderBottom:'1px solid var(--border)',flexShrink:0}}>
              <div><h1>Chat Tutor</h1><p className="tab-sub">Ask anything about this codebase</p></div>
            </div>
            <div className="chat-msgs">
              {chatHistory.map((m,i)=>(
                <div key={i} className={`bbl-wrap ${m.role}`}>
                  <div className="bbl-av">{m.role==='user'?'You':'AI'}</div>
                  <div className="bbl">
                    <div className="bbl-text">{m.content.split('**').map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}</div>
                    <div className="bbl-foot">
                      <span className="bbl-ts">{timeAgo(m.ts)}</span>
                      {m.role==='assistant'&&<>
                        <button className="bbl-act" onClick={()=>navigator.clipboard.writeText(m.content)}>copy</button>
                        <button className="bbl-act" onClick={()=>listen(m.content)}>▶</button>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading&&<div className="bbl-wrap assistant"><div className="bbl-av">AI</div><div className="bbl"><div className="typing"><span/><span/><span/></div></div></div>}
              <div ref={chatEndRef}/>
            </div>
            {chatHistory.length<=1&&(
              <div className="suggestions">
                {['How does auth work here?','What\'s the data flow for a request?','What design patterns are used?','Where do I start contributing?'].map(s=>(
                  <button key={s} className="chip" onClick={()=>setChatInput(s)}>{s}</button>
                ))}
              </div>
            )}
            <div className="chat-bar">
              <textarea className="chat-ta" rows={1} placeholder="Ask about architecture, patterns, files..." value={chatInput}
                onChange={e=>{setChatInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}}/>
              <button className="chat-send" onClick={sendChat} disabled={chatLoading}>{chatLoading?<span className="spin"/>:'↑'}</button>
            </div>
          </div>
        )}

      </main>
    </div>
  )

  // ── HOME ─────────────────────────────────────────────────────────
  return (
    <div className="home" data-theme={theme}>
      <div className="home-bg"><div className="bg-grid"/><div className="bg-glow g1"/><div className="bg-glow g2"/></div>

      <header className="home-hdr">
        <div className="hdr-logo"><span className="logo-mark">S</span><span className="logo-name">SysLearn</span></div>
        <div className="hdr-right">
          <button className="theme-btn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'☀':'🌙'}</button>
          {authLoading
            ? <div className="auth-skel"/>
            : user
              ? <div className="user-pill">
                  <img src={user.photoURL} alt="" className="user-av" referrerPolicy="no-referrer"/>
                  <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                  <button className="signout-btn" onClick={signOut}>Sign out</button>
                </div>
              : <button className="signin-btn" onClick={signInWithGoogle}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Sign in with Google
                </button>
          }
        </div>
      </header>

      <section className="hero">
        <div className="hero-eye">Open-source · Free · No setup</div>
        <h1 className="hero-h1">Understand any codebase<br/><em>in 30 seconds</em></h1>
        <p className="hero-p">Paste a GitHub URL. Get architecture diagrams, voice walkthrough,<br/>system design lessons, and an AI mentor — from the real code.</p>

        <div className={`url-bar glass${error?' err':''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--muted)',flexShrink:0}}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          <input className="url-in" placeholder="https://github.com/vercel/next.js" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAnalyze()}/>
          <button className="analyze-btn" onClick={handleAnalyze}>{!user?'Sign in to analyze':'Analyze →'}</button>
        </div>
        {error&&<div className="err-msg">⚠ {error}</div>}

        <div className="examples">
          <span>Try:</span>
          {['facebook/react','expressjs/express','tiangolo/fastapi','django/django','vercel/next.js'].map(r=>(
            <button key={r} className="ex-pill" onClick={()=>setUrl(`https://github.com/${r}`)}>{r}</button>
          ))}
        </div>

        {recentList.length>0&&(
          <div className="recent-block">
            <div className="recent-lbl">Recent</div>
            <div className="recent-row">
              {recentList.map(r=>(
                <button key={r.url} className="recent-item glass" onClick={()=>setUrl(r.url)}>
                  <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--muted2)'}}>{r.owner}/{r.repo}</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:'0.62rem',color:'var(--muted)'}}>{timeAgo(r.ts)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="how-section">
        <h2 className="sec-label centered">How it works</h2>
        <div className="how-steps">
          {[{n:'01',t:'Paste a GitHub URL',d:'Any public repo. No cloning, no install.'},
            {n:'02',t:'AI reads key files',d:'Smart ranker picks top 10 files. Sends to Gemini.'},
            {n:'03',t:'Get a full lesson',d:'Diagram, voice, snippets, chat tutor — instantly.'}
          ].map((s,i)=>(
            <div key={i} className="how-step glass">
              <div className="how-n">{s.n}</div>
              <div className="how-t">{s.t}</div>
              <div className="how-d">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="features-grid">
        {[
          ['🏛','Architecture analysis','Deep breakdown of patterns, data flow, and design decisions.'],
          ['🗺','Live diagram','Auto-generated Mermaid flowchart from the actual code.'],
          ['▶','Voice walkthrough','Natural voice narration. Hit play and listen.'],
          ['📚','Design lessons','Real system design patterns from this specific codebase.'],
          ['💻','Code snippets','Exact code showing how Redis, auth, queues are implemented.'],
          ['🔍','Deep dive','Pick any file. Ask a question. Get a senior-level explanation.'],
          ['🗂','Contributor guide','Where to start, important files, how to trace a request.'],
          ['💬','Chat tutor','Ask anything. Mentor-level answers from the real source code.'],
        ].map(([ic,t,d])=>(
          <div key={t} className="feat-card glass">
            <div className="feat-ic">{ic}</div>
            <div className="feat-t">{t}</div>
            <div className="feat-d">{d}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
