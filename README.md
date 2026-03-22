<div align="center">

<br/>

```
███████╗██╗   ██╗███████╗██╗     ███████╗ █████╗ ██████╗ ███╗   ██╗
██╔════╝╚██╗ ██╔╝██╔════╝██║     ██╔════╝██╔══██╗██╔══██╗████╗  ██║
███████╗ ╚████╔╝ ███████╗██║     █████╗  ███████║██████╔╝██╔██╗ ██║
╚════██║  ╚██╔╝  ╚════██║██║     ██╔══╝  ██╔══██║██╔══██╗██║╚██╗██║
███████║   ██║   ███████║███████╗███████╗██║  ██║██║  ██║██║ ╚████║
╚══════╝   ╚═╝   ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
```

### *Paste a GitHub URL. Learn system design. Automate your workflow.*

<br/>

[![Stars](https://img.shields.io/github/stars/your-username/syslearn?style=for-the-badge&color=FFD700&labelColor=0d0d0d)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-00FF9F?style=for-the-badge&labelColor=0d0d0d)](LICENSE)
[![Built for Hackathon](https://img.shields.io/badge/built_for-hackathon-FF4D6D?style=for-the-badge&labelColor=0d0d0d)](#)
[![Free to use](https://img.shields.io/badge/cost-$0-00FF9F?style=for-the-badge&labelColor=0d0d0d)](#apis)

<br/>

---

</div>

<br/>

## 🧠 What is SysLearn?

I built this because I kept getting lost reading large open-source codebases. You'd clone a repo, stare at 200 files, and have no idea where anything connects. I wanted something that could just *explain it to me* — like a senior engineer sitting next to me, walking through the architecture.

So SysLearn does exactly that:

1. **You paste a GitHub URL**
2. It reads the most important files automatically
3. An AI explains the system design — components, data flow, decisions
4. You get an animated diagram, voice narration, and a chat interface to ask follow-up questions
5. It can even scaffold the project folder structure locally for you

No installations. No paid APIs. Just a URL.

<br/>

---

## 🖼️ How it looks

<div align="center">

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   📎 https://github.com/vercel/next.js          [Teach me] │
│                                                             │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   📊 DIAGRAM             │   🎙 VOICE LESSON                │
│                          │                                  │
│   [Client]               │   "Next.js is a React framework  │
│      │                   │   with a file-based router. The  │
│      ▼                   │   server component model splits  │
│   [Router]               │   rendering between the edge     │
│    /  \                  │   and the client..."             │
│   ▼    ▼                 │                                  │
│ [SSR][API]               │   ▶ Play  ⏸ Pause  ↩ Replay    │
│                          │                                  │
├──────────────────────────┴──────────────────────────────────┤
│  💬 Ask anything...                              [Send →]   │
└─────────────────────────────────────────────────────────────┘
```

</div>

<br/>

---

## ✨ Features

| Feature | What it does |
|---|---|
| 🔍 **Smart File Picker** | Scores and ranks files by importance — skips tests, lock files, node_modules |
| 🗺 **Live Architecture Diagram** | Generates Mermaid diagrams directly from the code |
| 🎙 **Voice Narration** | Browser-native text-to-speech, free, no API needed |
| 💬 **Chat Tutor** | Ask follow-up questions, get mentor-style answers |
| 📁 **Local Scaffolding** | Generates shell commands to mirror the repo's folder structure locally |
| 🔄 **File Watcher** | Watch a folder and get AI suggestions as you add files |
| 🔁 **AI Fallback Router** | Gemini → Groq → message. Never dies during a demo |

<br/>

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          React Frontend                              │
│                                                                      │
│   UrlInput → SmartChunker → AI Router → LessonPlayer → ChatPanel    │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼              ▼
            GitHub REST API   Gemini 1.5     Groq API
            (file fetching)   (analysis)    (chat Q&A)
                    │             │              │
                    └─────────────┴──────────────┘
                                  │
                    ┌─────────────▼────────────────┐
                    │   Mermaid.js  +  Web Speech   │
                    │   (diagrams)  +  (narration)  │
                    └──────────────────────────────┘
```

No backend. No server. Everything runs in the browser except the file watcher (tiny optional Node script).

<br/>

---

## 🚀 Getting started

```bash
# Clone
git clone https://github.com/your-username/syslearn.git
cd syslearn

# Install
npm install

# Add your free API keys to .env
cp .env.example .env
```

Edit `.env`:

```env
VITE_GEMINI_KEY=your_key_here      # free at aistudio.google.com
VITE_GROQ_KEY=your_key_here        # free at console.groq.com
VITE_GITHUB_TOKEN=your_token_here  # free, just sign into GitHub
```

```bash
# Run
npm run dev
```

Open `http://localhost:5173`, paste any public GitHub URL, hit **Teach me**.

<br/>

---

## 🔑 APIs used (all free)

| API | What it's used for | Free limit |
|---|---|---|
| [Gemini 1.5 Flash](https://aistudio.google.com) | Architecture analysis, large context | 1M tokens/day |
| [Groq (Llama 3.1)](https://console.groq.com) | Chat Q&A, fast responses | 30 req/min |
| [GitHub REST API](https://docs.github.com/en/rest) | Fetch repo file tree + contents | 5000 req/hr (with token) |
| Web Speech API | Voice narration | Browser built-in, free forever |
| Mermaid.js | Diagram rendering | Open source, client-side |

**Total cost to run: $0.**

<br/>

---

## 📁 Project structure

```
syslearn/
├── src/
│   ├── components/
│   │   ├── UrlInput.jsx          # URL paste + parse
│   │   ├── LessonPlayer.jsx      # Main learning UI
│   │   ├── DiagramPanel.jsx      # Mermaid renderer
│   │   ├── VoiceControls.jsx     # Web Speech wrapper
│   │   └── ChatPanel.jsx         # Q&A interface
│   ├── lib/
│   │   ├── github.js             # File fetcher + smart ranker
│   │   ├── chunker.js            # Token budget + file scoring
│   │   ├── aiRouter.js           # Gemini → Groq fallback
│   │   └── prompts.js            # System design prompt templates
│   └── App.jsx
├── watcher/
│   └── watcher.js                # Optional local file watcher
├── .env.example
└── README.md
```

<br/>

---

## 🧩 How the smart file picker works

Not all files matter equally. The picker scores each file before sending anything to an AI:

```
README.md            → priority 1   (always read this)
package.json         → priority 2   (tells you the whole stack)
main.py / index.js   → priority 3   (entry points)
src/, lib/, core/    → priority 4   (actual logic)
tests/, *.lock       → skip         (noise)
node_modules/        → skip         (never)
```

Top 8–10 files get fetched. Total tokens capped at ~12,000 — safe for every free tier.

<br/>

---

## 🤖 AI fallback router

So the demo never dies:

```js
async function callAI(prompt) {
  try {
    return await callGemini(prompt)   // best free quota
  } catch {
    return await callGroq(prompt)     // fastest fallback
  }
}
```

Gemini handles big analysis. Groq handles snappy chat. If both fail, it says try again in 60s — but that's basically never during a normal session.

<br/>

---

## 📁 Local file automation

After the lesson, SysLearn can scaffold the project locally for you.

The AI generates a shell script based on the repo's architecture:

```bash
# Generated by SysLearn from github.com/expressjs/express
mkdir -p src/routes src/middleware src/models src/utils
touch src/index.js src/config.js
echo "✅ Project structure ready"
```

You review it. You run it. The AI doesn't touch your machine without you seeing exactly what it'll do.

For ongoing projects, the optional file watcher suggests where new files should live based on the architecture:

```bash
node watcher/watcher.js --project ./my-project --arch express
# 📁 auth.js created → suggest moving to: src/middleware/
```

<br/>

---

## 🎯 Hackathon theme fit

The theme is **Automation in Daily Life**.

Developers spend hours every day manually reading codebases to understand them before contributing. It's repetitive, slow, and no one talks about it. SysLearn automates that entire workflow:

- Reading and filtering relevant files → **automated**
- Understanding component relationships → **automated**
- Building folder structure for a new project → **automated**
- Getting up to speed on an unfamiliar repo → **automated**

The "daily life" here is a developer's daily life. And that's a real problem.

<br/>

---

## 🤝 Contributing

This started as a hackathon project. If you want to improve it:

1. Fork it
2. Create a branch: `git checkout -b feature/your-idea`
3. Push and open a PR

Anything is welcome — better prompts, more diagram types, support for private repos, better voice controls.

<br/>

---

## 📜 License

MIT — do whatever you want with it.

<br/>

---

<div align="center">

**Built by [Nabil](https://github.com/your-username) · Hackathon 2025**

*"I just wanted to understand open source codebases without spending 3 hours confused."*

</div>
