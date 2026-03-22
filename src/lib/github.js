export async function fetchRepo(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  const [, owner, repo] = match
  const cleanRepo = repo.replace(/\.git$/, '').split('/')[0]

  const headers = {}
  const token = import.meta.env.VITE_GITHUB_TOKEN
  if (token) headers['Authorization'] = `token ${token}`

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/HEAD?recursive=1`,
    { headers }
  )
  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`)
  const { tree } = await treeRes.json()

  const scored = tree
    .filter(f => f.type === 'blob')
    .map(f => ({ ...f, score: scoreFile(f.path) }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

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
      } catch { return null }
    })
  )

  return { owner, repo: cleanRepo, files: contents.filter(Boolean) }
}
