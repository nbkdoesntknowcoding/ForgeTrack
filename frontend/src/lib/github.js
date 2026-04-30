// Parse a GitHub repo URL into { owner, repo }, or return null if invalid.
export function parseRepoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    if (!/^(www\.)?github\.com$/.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

export function isValidRepoUrl(url) {
  return parseRepoUrl(url) !== null;
}
