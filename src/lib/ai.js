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
  // Strip markdown fences
  let c = raw.replace(/```json\n?|```\n?/g, '').trim()
  
  // Find outermost { }
  const s = c.indexOf('{')
  const e = c.lastIndexOf('}')
  if (s !== -1 && e !== -1) c = c.slice(s, e + 1)
  
  // Fix common AI JSON mistakes
  c = c
    .replace(/,\s*}/g, '}')        // trailing commas in objects
    .replace(/,\s*]/g, ']')        // trailing commas in arrays
    .replace(/\n/g, ' ')           // newlines inside strings
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // control chars
  
  try {
    return JSON.parse(c)
  } catch {
    // Last resort: try to extract just the fields we need
    console.error('JSON parse failed, raw snippet:', c.slice(0, 500))
    throw new Error('AI returned malformed JSON. Try again.')
  }
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
