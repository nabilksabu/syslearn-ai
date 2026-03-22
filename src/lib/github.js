const PRIORITY_FILES = [
  'readme.md', 'readme.txt', 'readme',
  'package.json', 'requirements.txt', 'go.mod', 'cargo.toml', 'pom.xml',
  'main.py', 'app.py', 'server.py', 'index.js', 'main.js', 'server.js',
  'app.js', 'main.ts', 'app.ts', 'server.ts', 'index.ts',
  'main.go', 'main.rs', 'main.java', 'application.java',
  'docker-compose.yml', 'dockerfile', '.env.example',
]

const SKIP_PATTERNS = [
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'vendor', '.cache', 'coverage', '.nyc_output', 'test', 'tests',
  'spec', '__tests__', '.lock', 'package-lock', 'yarn.lock',
  'pnpm-lock', '.min.js', '.min.css', '.map', '.snap'
]

function scoreFile(path) {
  const lower = path.toLowerCase()
  const filename = lower.split('/').pop()

  for (const skip of SKIP_PATTERNS) {
    if (lower.includes(skip)) return -1
  }

  const priorityIdx = PRIORITY_FILES.indexOf(filename)
  if (priorityIdx !== -1) return 100 - priorityIdx

  if (lower.match(/\.(md|txt)$/)) return 60
  if (lower.match(/src\/|lib\/|core\/|api\/|routes\/|controllers\/|services\//)) return 50
  if (lower.match(/\.(js|ts|py|go|rs|java|jsx|tsx)$/)) return 40
  if (lower.match(/\.(json|yaml|yml|toml|env)$/)) return 30

  return 10
}

export async function fetchRepo(url, githubToken = null) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) throw new Error('Invalid GitHub URL')

  const [, owner, repo] = match
  const cleanRepo = repo.replace(/\.git$/, '').split('/')[0]

const headers = {}
const githubToken = import.meta.env.VITE_GITHUB_TOKEN
if (githubToken) headers['Authorization'] = `token ${githubToken}`
  // Get file tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/HEAD?recursive=1`,
    { headers }
  )
  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`)
  const { tree } = await treeRes.json()

  // Score and sort
  const scored = tree
    .filter(f => f.type === 'blob')
    .map(f => ({ ...f, score: scoreFile(f.path) }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  // Fetch file contents in parallel
  const contents = await Promise.all(
    scored.map(async f => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${cleanRepo}/contents/${f.path}`,
          { headers }
        )
        if (!res.ok) return null
        const data = await res.json()
        if (!data.content) return null
        const text = atob(data.content.replace(/\n/g, ''))
        return { path: f.path, content: text.slice(0, 3000) }
      } catch {
        return null
      }
    })
  )

  return {
    owner,
    repo: cleanRepo,
    files: contents.filter(Boolean)
  }
}
