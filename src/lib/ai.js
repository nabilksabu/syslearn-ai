const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY

const GEMINI_URL = import.meta.env.DEV
  ? '/gemini/v1beta/models/gemini-1.5-flash:generateContent'
  : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

const GROQ_URL = import.meta.env.DEV
  ? '/groq/openai/v1/chat/completions'
  : 'https://api.groq.com/openai/v1/chat/completions'

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('No Gemini key in .env')
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 6000 }
    })
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Gemini error:', res.status, err)
    throw new Error(`Gemini ${res.status}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callGroq(prompt) {
  if (!GROQ_KEY) throw new Error('No Groq key in .env')
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 6000,
      temperature: 0.3
    })
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Groq error:', res.status, err)
    throw new Error(`Groq ${res.status}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function callAI(prompt) {
  try {
    const r = await callGemini(prompt)
    if (r) return r
  } catch (e) { console.warn('Gemini failed, trying Groq:', e.message) }
  try {
    const r = await callGroq(prompt)
    if (r) return r
  } catch (e) { console.warn('Groq also failed:', e.message) }
  throw new Error('Both APIs failed. Check your .env keys.')
}

function parseJSON(raw) {
  let c = raw.replace(/```json\n?|```\n?/g, '').trim()
  const s = c.indexOf('{')
  const e = c.lastIndexOf('}')
  if (s !== -1 && e !== -1) c = c.slice(s, e + 1)
  c = c.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
  try {
    return JSON.parse(c)
  } catch (err) {
    console.error('JSON parse failed. Raw:', c.slice(0, 400))
    throw new Error('AI returned malformed JSON. Try again.')
  }
}

export async function analyzeRepo({ owner, repo, files }) {
  const filesText = files
    .map(f => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``)
    .join('\n\n')

  const prompt = `You are a senior software engineer teaching system design.
Analyze this GitHub repo: ${owner}/${repo}

FILES:
${filesText}

IMPORTANT: Return ONLY a valid JSON object. No markdown, no backticks, no text before or after. Must start with { and end with }.

{
  "summary": "2-3 sentences about what this does",
  "techStack": ["tech1", "tech2"],
  "architecture": "3-4 paragraphs about the architectural pattern, data flow, design decisions, and what students should learn",
  "components": [
    { "name": "Name", "role": "what it does", "connects": ["Other"], "layer": "api" }
  ],
  "mermaid": "flowchart TD\n  A[Client] --> B[Server]\n  B --> C[Database]",
  "lessons": [
    { "title": "Lesson title", "explanation": "2-3 sentences about this pattern in the codebase", "pattern": "Behavioral" }
  ],
  "deepDive": [
    { "topic": "Topic name", "content": "3-4 sentences with specific file references" }
  ],
  "contributorGuide": "2-3 paragraphs on how to navigate and contribute to this codebase",
  "keyFiles": [
    { "path": "filepath", "purpose": "one sentence", "type": "js" }
  ],
  "codeSnippets": [
    { "title": "How X works", "file": "filepath", "concept": "pattern name", "code": "10-15 line snippet", "explanation": "2-3 sentences" }
  ]
}`

  const raw = await callAI(prompt)
  return parseJSON(raw)
}

export async function chatWithRepo(question, repoContext, history) {
  const historyText = history
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`)
    .join('\n')

  const prompt = `You are a senior engineer mentoring a student about ${repoContext.repoData?.owner}/${repoContext.repoData?.repo}.

Summary: ${repoContext.summary}
Stack: ${repoContext.techStack?.join(', ')}
Architecture: ${repoContext.architecture?.slice(0, 400)}

${historyText}
Student: ${question}

Answer in 3-5 sentences. Reference actual files and patterns. Be direct and helpful.`

  return await callAI(prompt)
}

export async function deepDive(fileName, fileContent, question) {
  const prompt = `You are a senior engineer reviewing this specific file.

File: ${fileName}
\`\`\`
${fileContent.slice(0, 3000)}
\`\`\`

Question: ${question || 'Explain this file — what it does, how it works, key patterns, what a contributor must know.'}

Answer in 5-7 sentences. Reference specific function names and explain WHY things are built this way.`

  return await callAI(prompt)
}
