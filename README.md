<div align="center">

<br/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=14&duration=3000&pause=1000&color=4A9EFF&center=true&vCenter=true&width=435&lines=Paste+a+GitHub+URL.;Learn+its+system+design.;Understand+any+codebase." alt="Typing SVG" />

<br/>

# ◈ SysLearn AI

### *Turn any GitHub repository into an interactive system design lesson.*

<br/>

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-4a9eff?style=for-the-badge&logoColor=white)](https://syslearn-ai.vercel.app)
[![Made with React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Powered by Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![Groq](https://img.shields.io/badge/Groq_LLaMA_3.3-F55036?style=for-the-badge&logoColor=white)](https://console.groq.com)
[![License MIT](https://img.shields.io/badge/License-MIT-34d399?style=for-the-badge)](LICENSE)
[![Free to use](https://img.shields.io/badge/Cost-$0-34d399?style=for-the-badge)](##apis)

<br/>

---

</div>

<br/>

## 🧠 What is SysLearn?

I built this because learning system design from real codebases is painful. You clone a repo, stare at hundreds of files, and have no idea where anything connects. There's no shortcut — you just read everything and hope something clicks.

**SysLearn automates that entire process.** Paste any public GitHub URL and within 30 seconds you get a full interactive system design lesson — generated live from the actual code, not a generic template.

<br/>

---

<br/>

## ✨ Features

<br/>

| | Feature | What it does |
|---|---|---|
| ◈ | **Architecture Analysis** | 5-6 paragraph deep breakdown — patterns, data flow, design decisions, scalability considerations |
| ⬡ | **Live Diagram** | Auto-generated Mermaid flowchart of components and how they connect |
| ▶ | **Voice Walkthrough** | Natural voice narration of every section. Hit play and just listen |
| ◎ | **System Design Lessons** | Real patterns extracted from this specific codebase, not textbook theory |
| ⊕ | **Deep Dive** | Technical breakdown of specific files, functions, and patterns in the repo |
| ◉ | **Chat Tutor** | Ask anything — get mentor-level answers grounded in the actual code |
| ⌥ | **Contributor Guide** | Exactly where to start reading, what matters, how to trace a request |

<br/>

---

<br/>

## 🖥️ How it looks

```
┌─────────────────────────────────────────────────────────────────────┐
│  ◈ SysLearn                                          ● Keys saved   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│        Understand any codebase in minutes                           │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ ⌥  https://github.com/tiangolo/fastapi      [ Analyze → ]  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   Try: facebook/react  expressjs/express  tiangolo/fastapi          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

After analysis:

┌──────────────────┬──────────────────────────────────────────────────┐
│ ◈ SysLearn       │                                                  │
│                  │  System Architecture              [ ▶ Listen ]   │
│ tiangolo/fastapi │  ─────────────────────────────────────────────   │
│                  │  FastAPI is built on a microframework pattern.    │
│ FastAPI          │  At its core it wraps Starlette for ASGI and      │
│ Python           │  Pydantic for type-safe data validation...        │
│ Pydantic         │                                                  │
│ OpenAPI          │  Components                                      │
│                  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐     │
│ ◈ Architecture   │  │ Router   │ │ Depends  │ │ Pydantic     │     │
│ ⬡ Diagram        │  │ Request  │ │ Injection│ │ Validation   │     │
│ ◎ Lessons        │  └──────────┘ └──────────┘ └──────────────┘     │
│ ⊕ Deep Dive      │                                                  │
│ ⌥ Code Guide     ├──────────────────────────────────────────────────┤
│ ◉ Chat Tutor  2  │  💬 How does dependency injection work here?      │
│                  │  ─────────────────────────────────────────────   │
│ ← New repo       │  AI: FastAPI's Depends() system works by...      │
└──────────────────┴──────────────────────────────────────────────────┘
```

<br/>

---

<br/>

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed → [nodejs.org](https://nodejs.org)
- Free Gemini API key → [aistudio.google.com](https://aistudio.google.com)
- Free Groq API key → [console.groq.com](https://console.groq.com)

### Installation

```bash
# Clone the repo
git clone https://github.com/nabilksabu/syslearn-ai.git
cd syslearn-ai

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173`, click **+ Add keys**, paste your API keys, and you're ready.

### Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

That's it. Vercel auto-detects Vite and deploys in ~60 seconds.

<br/>

---

<br/>

## 🔑 APIs Used — Total Cost: $0

| API | Purpose | Free Limit |
|---|---|---|
| [Gemini 2.0 Flash](https://aistudio.google.com) | Primary analysis — large context, deep reasoning | 1,500 req/day |
| [Groq LLaMA 3.3 70B](https://console.groq.com) | Fallback + chat Q&A — ultra fast responses | 14,400 req/day |
| [GitHub REST API](https://docs.github.com/en/rest) | Fetch repo file tree and contents | 5,000 req/hr |
| Web Speech API | Voice narration | Browser built-in, always free |
| Mermaid.js | Diagram rendering | Open source, client-side |

**Smart fallback router:** if Gemini rate-limits, Groq automatically catches it. The app never dies during a demo.

<br/>

---

<br/>

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│                                                         │
│  UrlInput → SmartChunker → AI Router → LessonPlayer     │
│                                ↓                        │
│         ┌──────────────────────┼─────────────────┐      │
│         ▼                      ▼                 ▼      │
│    Architecture           Diagram Gen         Chat Q&A  │
│    + Lessons              (Mermaid.js)        (Groq)    │
│    + Deep Dive                                          │
│    + Code Guide           Voice               Key Files │
│                           (Web Speech)                  │
└─────────────────────────────────────────────────────────┘
         │                      │                 │
         ▼                      ▼                 ▼
   GitHub REST API        Gemini 2.0 Flash    Groq API
   (file fetching)        (primary AI)        (fallback)
```

**No backend. No server costs. Everything runs in the browser** except API calls to Gemini/Groq which are proxied through Vite in development and directly in production.

<br/>

---

<br/>

## 📁 Project Structure

```
syslearn-ai/
├── src/
│   ├── App.jsx              # Main app — all UI phases (home, loading, lesson)
│   ├── App.css              # Full dark theme — DM Mono + Syne fonts
│   └── lib/
│       ├── github.js        # Repo fetcher + smart file scorer/ranker
│       └── ai.js            # Gemini/Groq calls + prompt engine + fallback router
├── vite.config.js           # Dev proxy for Gemini + Groq (avoids CORS)
├── index.html
└── package.json
```

<br/>

---

<br/>

## 🧩 How the Smart File Picker Works

Not all files matter equally. The picker scores every file before sending anything to AI:

```
README.md              → score 100   always read first
package.json           → score 98    reveals the whole stack
main.py / index.js     → score 96    entry points
src/ lib/ core/ api/   → score 50    actual business logic
*.config.* *.yaml      → score 30    infrastructure hints
tests/ *.lock          → score -1    skipped entirely
node_modules/          → score -1    never touched
```

Top 10 files get fetched. Token budget capped at ~12,000 — safe for every free tier and fast enough to feel instant.

<br/>

---

<br/>

## 🤖 The Prompt Engine

The AI is prompted to act as a **senior engineer teaching a student**, not a documentation generator. Key difference:

```
❌ "This file exports a function that handles HTTP requests."
✅ "The router here uses a middleware chain pattern — every request
    flows through auth → validation → handler in sequence. This is
    the same pattern Express.js made famous, and it's why you can
    add logging or rate limiting by just inserting a new middleware
    without touching any handler code."
```

The prompt asks for: architecture patterns, data flow, design decisions, scalability trade-offs, contributor guidance, and specific file references throughout.

<br/>

---

<br/>

## 🎯 Hackathon Theme — Automation in Daily Life

Developers spend **2-3 hours** every day reading unfamiliar codebases — to understand a new project, prepare for a PR review, or learn how a library works. It's repetitive, it's slow, and the process is identical every single time.

SysLearn automates that entire daily workflow:

```
Manual process (2-3 hours)          SysLearn (30 seconds)
──────────────────────────          ─────────────────────
Clone repo                    →     Paste URL
Find entry point manually     →     Smart file ranker does it
Read 50+ files                →     AI reads and synthesizes
Draw architecture mentally    →     Live diagram generated
Google design patterns        →     Lessons extracted from code
Ask a senior engineer         →     Chat tutor available instantly
```

<br/>

---

<br/>

## 🗺️ Roadmap

- [ ] Support private repos (GitHub OAuth)
- [ ] Export lesson as PDF
- [ ] Compare two repos side by side
- [ ] Generate quiz questions from the codebase
- [ ] Highlight which files to read in what order
- [ ] VS Code extension

<br/>

---

<br/>

## 🤝 Contributing

Contributions welcome. This started as a hackathon project with a lot of room to grow.

```bash
git checkout -b feature/your-idea
# make your changes
git commit -m "add: your feature"
git push origin feature/your-idea
# open a PR
```

Good first issues: better Mermaid diagram prompts, more voice options, support for more file types, UI improvements.

<br/>

---

<br/>

## 📜 License

MIT — use it, fork it, build on it.

<br/>

---

<br/>

<div align="center">

**Built by [Nabil](https://github.com/nabilksabu) · Hackathon 2025**

<br/>

*"I just wanted to understand open source codebases without spending 3 hours confused."*

<br/>

⭐ Star this repo if it helped you

</div>
