const GEMINI_URL = '/gemini/v1beta/models/gemini-1.5-flash-latest:generateContent'
const GROQ_URL = '/groq/openai/v1/chat/completions'

async function callGemini(prompt, apiKey) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
    })
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Gemini error:', res.status, err)
    throw new Error(`Gemini ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callGroq(prompt, apiKey) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.7
    })
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Groq error:', res.status, err)
    throw new Error(`Groq ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

export async function callAI(prompt, geminiKey, groqKey) {
  if (geminiKey) {
    try { return await callGemini(prompt, geminiKey) } catch (e) { console.warn('Gemini failed, trying Groq', e) }
  }
  if (groqKey) {
    try { return await callGroq(prompt, groqKey) } catch (e) { console.warn('Groq failed', e) }
  }
  throw new Error('Both APIs failed. Check your keys or wait 60s.')
}

export async function analyzeRepo({ owner, repo, files }, geminiKey, groqKey) {
  const filesText = files.map(f => `### ${f.path}\n${f.content}`).join('\n\n')

  const prompt = `You are a senior software engineer teaching system design to students.

Analyze this GitHub repository: ${owner}/${repo}

Here are the key files:
${filesText}

Return a JSON object (no markdown, no backticks, just raw JSON) with this exact shape:
{
  "summary": "2-3 sentence plain English description of what this project does",
  "techStack": ["list", "of", "technologies", "detected"],
  "architecture": "3-4 paragraphs explaining the system design: what pattern it uses, how data flows, key architectural decisions, and what a student should learn from this",
  "components": [
    { "name": "ComponentName", "role": "what it does", "connects": ["OtherComponent"] }
  ],
  "mermaid": "a valid mermaid flowchart diagram (flowchart TD) showing the main components and data flow. Use simple node names, no special characters",
  "lessons": [
    { "title": "Lesson title", "explanation": "2-3 sentence explanation of a system design concept visible in this codebase" }
  ],
  "codeExplainer": "explain the codebase structure to someone wanting to contribute: where to start, what the main files do, how to find your way around"
}`

  const raw = await callAI(prompt, geminiKey, groqKey)
  const clean = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('AI returned invalid JSON')
  }
}

export async function chatWithRepo(question, repoContext, history, geminiKey, groqKey) {
  const historyText = history.slice(-6).map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`).join('\n')

  const prompt = `You are a senior engineer mentoring a student about this codebase.

Repo context:
${JSON.stringify(repoContext, null, 2)}

Recent conversation:
${historyText}

Student asks: ${question}

Answer in 3-5 sentences. Be direct, specific to this codebase, and teach like a mentor — not like documentation. Use plain language.`

  return await callAI(prompt, geminiKey, groqKey)
}
