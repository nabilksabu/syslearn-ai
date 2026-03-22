// Keys are read at call-time from localStorage so swapping keys works without a rebuild
function getKey(envKey, storageKey) {
  return localStorage.getItem(storageKey) || import.meta.env[envKey] || ''
}
export function getGeminiKey() { return getKey('VITE_GEMINI_KEY', 'sl_gemini_key') }
export function getGroqKey()   { return getKey('VITE_GROQ_KEY',   'sl_groq_key')   }

const GEMINI_URL = import.meta.env.DEV
  ? '/gemini/v1beta/models/gemini-2.0-flash:generateContent'
  : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const GROQ_URL = import.meta.env.DEV
  ? '/groq/openai/v1/chat/completions'
  : 'https://api.groq.com/openai/v1/chat/completions'

async function callGemini(prompt, isJson = false) {
  const key = getGeminiKey()
  if (!key) throw new Error('No Gemini key — add it in Settings')
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: isJson ? 'application/json' : 'text/plain'
    }
  }
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    console.error('Gemini Error:', res.status, e)
    throw new Error(`Gemini ${res.status}: ${e.error?.message || 'Unknown error'}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text
}

async function callGroq(prompt) {
  const key = getGroqKey()
  if (!key) throw new Error('No Groq key — add it in Settings')
  const body = {
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8192,
    temperature: 0.1
  }
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const e = await res.text()
    console.error('Groq Error:', res.status, e)
    throw new Error(`Groq ${res.status}: ${e.slice(0, 120)}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function callAI(prompt, isJson = false) {
  let gErr, qErr
  try {
    return await callGemini(prompt, isJson)
  } catch (e) {
    gErr = e.message
    console.warn('Gemini failed, trying Groq...', gErr)
  }
  try {
    return await callGroq(prompt)
  } catch (e) {
    qErr = e.message
    console.warn('Groq failed:', qErr)
  }

  if (gErr?.includes('429') || qErr?.includes('429')) {
    throw new Error('AI services are rate-limited. Wait a minute and try again.')
  }
  if (gErr?.includes('401') || qErr?.includes('401') || gErr?.includes('403') || qErr?.includes('403') || gErr?.includes('API_KEY_INVALID') || qErr?.includes('API_KEY_INVALID')) {
    throw new Error('Invalid API key. Open Settings (⚙) and paste a fresh key.')
  }
  throw new Error(`Both AI services failed.\nGemini: ${gErr}\nGroq: ${qErr}`)
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw.trim())
  } catch {
    let c = raw.replace(/```json\n?|```\n?/g, '').trim()
    const s = c.indexOf('{'), e = c.lastIndexOf('}')
    if (s !== -1 && e !== -1) c = c.slice(s, e + 1)
    try {
      return JSON.parse(c)
    } catch (e2) {
      console.error('JSON parse failed:', c.slice(0, 500))
      throw new Error('AI returned malformed JSON. Please try again.')
    }
  }
}

export async function analyzeRepo({ owner, repo, files }) {
  const filesText = files.map(f => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``).join('\n\n')

  const prompt = `You are a senior software engineer analyzing the repository ${owner}/${repo}.
FILES:
${filesText}

Task: Return a detailed JSON object with this exact structure:
{
  "summary": "2-3 sentences: purpose and problem solved",
  "techStack": ["tech1", "tech2"],
  "architecture": "3 detailed paragraphs on pattern, data flow, and design decisions.",
  "components": [
    { "name": "Name", "role": "description", "connects": ["Other"], "layer": "api|data|ui|infra|util" }
  ],
  "mermaid": "flowchart TD\\n  A --> B",
  "lessons": [
    {
      "title": "Title",
      "explanation": "Usage in this codebase (reference files).",
      "pattern": "Behavioral|Structural|Creational|Scalability|Security|Performance|Reliability",
      "difficulty": "beginner|intermediate|advanced",
      "realWorldUse": "One sentence"
    }
  ],
  "deepDive": [
    { "topic": "Topic", "content": "3-4 sentences with file references.", "keyFiles": ["file.js"] }
  ],
  "contributorGuide": "3 paragraphs on starting, key files, and conventions.",
  "keyFiles": [
    { "path": "path", "purpose": "description", "type": "js|ts|py|go|rs|md|json|yaml|other" }
  ],
  "codeSnippets": [
    {
      "title": "Snippet Title",
      "file": "path",
      "concept": "concept name",
      "code": "max 15 lines of code",
      "explanation": "3 sentences max",
      "whyItMatters": "One sentence"
    }
  ],
  "systemDesignConcepts": [
    { "concept": "Name", "howUsedHere": "Usage here", "learnMore": "Where to look" }
  ],
  "gettingStarted": {
    "firstStep": "First action",
    "readingOrder": ["file1", "file2"],
    "setupCommands": ["npm install"],
    "goodFirstIssues": ["Idea"]
  }
}

Return ONLY the JSON object.`

  const raw = await callAI(prompt, true)
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
