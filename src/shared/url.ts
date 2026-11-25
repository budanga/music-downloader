/** Validate that a URL is a YouTube / YouTube Music video or playlist link. */
export function isValidYoutubeUrl(input: string): boolean {
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return false
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '')
  if (host === 'youtu.be') return url.pathname.length > 1
  if (host !== 'youtube.com') return false

  if (url.pathname === '/watch') return url.searchParams.has('v')
  if (url.pathname === '/playlist') return url.searchParams.has('list')
  return /^\/(shorts|embed|v)\/[\w-]+/.test(url.pathname)
}
