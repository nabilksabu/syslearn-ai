const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY

const GEMINI_URL = import.meta.env.DEV
  ? '/gemini/v1beta/models/gemini-1.5-flash:generateContent'
  : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

const GROQ_URL = import.meta.env.DEV
  ? '/groq/openai/v1/chat/completions'
  : 'https://api.groq.com/openai/v1/chat/completions'

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('No Gemini key')
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
    })
  })
  if (!res.ok) { const e = await res.text(); console.error('Gemini:', res.status, e); throw new Error(`Gemini ${res.status}`) }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callGroq(prompt) {
  if (!GROQ_KEY) throw new Error('No Groq key')
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.3
    })
  })
  if (!res.ok) { const e = await res.text(); console.error('Groq:', res.status, e); throw new Error(`Groq ${res.status}`) }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function callAI(prompt) {
  try { const r = await callGemini(prompt); if (r) return r } catch (e) { console.warn('Gemini failed:', e.message) }
  try { const r = await callGroq(prompt); if (r) return r } catch (e) { console.warn('Groq failed:', e.message) }
  throw new Error('Both APIs failed. Check your keys.')
}

function parseJSON(raw) {
  let c = raw.replace(/```json\n?|```\n?/g, '').trim()
  const s = c.indexOf('{'), e = c.lastIndexOf('}')
  if (s !== -1 && e !== -1) c = c.slice(s, e + 1)
  c = c.replace(/,(\s*[}\]])/g, '$1')
  try { return JSON.parse(c) } catch {
    console.error('JSON parse failed:', c.slice(0, 300))
    throw new Error('AI returned malformed JSON. Try again.')
  }
}

export async function analyzeRepo({ owner, repo, files }) {
  const filesText = files.map(f => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``).join('\n\n')

  const prompt = `You are a senior software engineer teaching system design to students who want to learn from real codebases and make open source contributions.

Analyze this GitHub repository deeply: ${owner}/${repo}

FILES:
${filesText}

Return ONLY a raw JSON object. No markdown. No backticks. Start with { end with }.

{
  "summary": "3-4 sentences: what this does, who uses it, why it exists, what problem it solves",
  "techStack": ["tech1", "tech2"],
  "architecture": "Write 5 detailed paragraphs. Paragraph 1: What architectural pattern is used (MVC, microservices, event-driven, layered, etc) and why this pattern fits this project. Paragraph 2: How data flows through the system from user input to output, step by step. Paragraph 3: The key design decisions made by the authors and the trade-offs involved. Paragraph 4: How components are decoupled and what that enables (testability, scalability, etc). Paragraph 5: What a student learning system design should specifically study in this codebase and why.",
  "components": [
    { "name": "ComponentName", "role": "clear one sentence description of what this does and why it exists", "connects": ["OtherComponent"], "layer": "api|data|ui|infra|util" }
  ],
  "mermaid": "flowchart TD\n  Client[Client] --> Router[Router]\n  Router --> Handler[Request Handler]\n  Handler --> DB[Database]",
  "lessons": [
    {
      "title": "Lesson title — specific to this codebase",
      "explanation": "3-4 sentences explaining this design pattern as it appears in THIS codebase. Name actual files. Explain why the authors made this choice and what a student learns from it.",
      "pattern": "Behavioral|Structural|Creational|Scalability|Security|Performance|Reliability",
      "difficulty": "beginner|intermediate|advanced",
      "realWorldUse": "One sentence on where this pattern appears in production systems like Netflix, Uber, etc."
    }
  ],
  "deepDive": [
    {
      "topic": "Specific technical topic",
      "content": "4-5 sentences with specific file names, function names, and line-level references. Explain the mechanism, not just what it does.",
      "keyFiles": ["file1.js", "file2.py"]
    }
  ],
  "contributorGuide": "Write 4 paragraphs. Paragraph 1: Where to start reading — the single most important file and why. Paragraph 2: The 3-4 most important files and what each one does. Paragraph 3: How to trace a complete request or feature from entry point to response. Paragraph 4: The coding patterns and conventions used throughout that a new contributor must understand.",
  "keyFiles": [
    { "path": "filepath", "purpose": "one sentence — what this file does and why it matters for the architecture", "type": "js|ts|py|go|rs|md|json|yaml|other" }
  ],
  "codeSnippets": [
    {
      "title": "How [specific concept] is implemented",
      "file": "filepath",
      "concept": "e.g. Dependency Injection, Middleware chain, Event emitter, Repository pattern",
      "code": "paste 10-20 lines of actual code from the file that demonstrates this concept",
      "explanation": "3-4 sentences explaining what this code does line by line and what system design concept it demonstrates",
      "whyItMatters": "One sentence on why understanding this makes you a better engineer"
    }
  ],
  "systemDesignConcepts": [
    {
      "concept": "e.g. Separation of Concerns",
      "howUsedHere": "2-3 sentences on exactly how this concept appears in this codebase",
      "learnMore": "One sentence pointing to where in the code to look"
    }
  ],
  "gettingStarted": {
    "firstStep": "The single first thing to do to understand this codebase",
    "readingOrder": ["file1", "file2", "file3"],
    "setupCommands": ["npm install", "npm run dev"],
    "goodFirstIssues": ["Describe a good beginner contribution", "Another one"]
  }
}`

  const raw = await callAI(prompt)
  return parseJSON(raw)
}

export async function chatWithRepo(question, repoContext, history) {
  const historyText = history.slice(-8).map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`).join('\n')

  const prompt = `You are a senior software engineer mentoring a student about ${repoContext.repoData?.owner}/${repoContext.repoData?.repo}.

Repo context:
- Summary: ${repoContext.summary}
- Stack: ${repoContext.techStack?.join(', ')}
- Architecture: ${repoContext.architecture?.slice(0, 500)}
- Key files: ${repoContext.keyFiles?.map(f => `${f.path}: ${f.purpose}`).slice(0, 5).join(', ')}

Recent conversation:
${historyText}

Student asks: ${question}

Answer in 4-6 sentences. Be specific — name actual files and functions from this codebase when relevant. Teach like a senior engineer explaining to a junior: direct, practical, with context on WHY not just WHAT.`

  return await callAI(prompt)
}

export async function deepDive(fileName, fileContent, question) {
  const prompt = `You are a senior software engineer doing a detailed code review and explanation.

File being analyzed: ${fileName}

File contents:
\`\`\`
${fileContent.slice(0, 4000)}
\`\`\`

Question: ${question || 'Give a comprehensive explanation of this file: what it does, how it works, the key functions and their responsibilities, design patterns used, and what a contributor needs to understand before modifying it.'}

Provide a thorough 6-8 sentence explanation. Reference specific function names, variable names, and line patterns you can see. Explain the WHY behind design choices, not just the what. End with one concrete tip for someone who wants to modify or extend this file.`

  return await callAI(prompt)
}
