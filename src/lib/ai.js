const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY
const GEMINI_URL = '/gemini/v1beta/models/gemini-2.0-flash:generateContent'
const GROQ_URL = '/groq/openai/v1/chat/completions'

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('No Gemini key in .env')
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
    })
  })
  if (!res.ok) { const e = await res.text(); console.error('Gemini:', res.status, e); throw new Error(`Gemini ${res.status}`) }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callGroq(prompt) {
  if (!GROQ_KEY) throw new Error('No Groq key in .env')
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.4 })
  })
  if (!res.ok) { const e = await res.text(); console.error('Groq:', res.status, e); throw new Error(`Groq ${res.status}`) }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function callAI(prompt) {
  try { const r = await callGemini(prompt); if (r) return r } catch (e) { console.warn('Gemini failed, trying Groq:', e.message) }
  try { const r = await callGroq(prompt); if (r) return r } catch (e) { console.warn('Groq also failed:', e.message) }
  throw new Error('Both APIs failed. Check your .env keys.')
}

function parseJSON(raw) {
  let c = raw.replace(/```json\n?|```\n?/g, '').trim()
  const s = c.indexOf('{'), e = c.lastIndexOf('}')
  if (s !== -1 && e !== -1) c = c.slice(s, e + 1)
  try { return JSON.parse(c) } catch { throw new Error('AI returned malformed JSON. Try again.') }
}

export async function analyzeRepo({ owner, repo, files }) {
  const filesText = files.map(f => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 2500)}\n\`\`\``).join('\n\n')
  const prompt = `You are a senior software engineer teaching system design.
Repo: ${owner}/${repo}
FILES:\n${filesText}

Return ONLY raw JSON, no markdown, starting with { ending with }:
{
  "summary": "3-4 sentences what this does and why it exists",
  "techStack": ["tech1"],
  "architecture": "5-6 paragraphs: pattern used, data flow, design decisions, decoupling, scalability, what students must learn",
  "components": [{ "name": "CamelCase", "role": "one sentence", "connects": ["Other"], "layer": "api|data|ui|infra|util" }],
  "mermaid": "flowchart TD\n  A[Client] --> B[Server]\n  B --> C[DB]",
  "lessons": [{ "title": "title", "explanation": "3-4 sentences with file references", "pattern": "Behavioral|Structural|Scalability|Security|Performance" }],
  "deepDive": [{ "topic": "topic", "content": "4-5 sentences with function names" }],
  "contributorGuide": "4-5 paragraphs on navigating and contributing",
  "keyFiles": [{ "path": "path", "purpose": "one sentence", "type": "js|ts|py|go|md|json|yaml|other" }],
  "codeSnippets": [{ "title": "How X works", "file": "path", "concept": "Redis caching / Auth middleware / etc", "code": "actual 10-20 line snippet", "explanation": "3-4 sentences on what this demonstrates" }]
}`
  return parseJSON(await callAI(prompt))
}

export async function chatWithRepo(question, ctx, history) {
  const h = history.slice(-8).map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`).join('\n')
  const prompt = `Senior engineer mentoring about ${ctx.repoData?.owner}/${ctx.repoData?.repo}.
Summary: ${ctx.summary}
Stack: ${ctx.techStack?.join(', ')}
Architecture: ${ctx.architecture?.slice(0, 500)}
Key files: ${ctx.keyFiles?.map(f => `${f.path}: ${f.purpose}`).join(', ')}

${h}
Student: ${question}

Answer 4-6 sentences. Reference actual files and patterns. Teach like a mentor, not documentation.`
  return await callAI(prompt)
}

export async function deepDive(fileName, fileContent, question) {
  const prompt = `Senior engineer doing deep code review.
File: ${fileName}
\`\`\`\n${fileContent.slice(0, 4000)}\n\`\`\`
Question: ${question || 'Explain this file deeply — what it does, how it works, key patterns, what a contributor must know.'}

6-8 sentences. Reference specific functions and design decisions. Explain WHY, not just what. End with what someone needs to understand before modifying this file.`
  return await callAI(prompt)
}
