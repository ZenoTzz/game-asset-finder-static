import type { LocalDownloadRecord, NetworkImageResult, NetworkSearchProvider } from '../types'

const localApiBase = import.meta.env.VITE_LOCAL_API_BASE || 'http://127.0.0.1:8787'

export async function searchNetworkImages(query: string): Promise<{
  mode: 'local' | 'static'
  results: NetworkImageResult[]
  providers: NetworkSearchProvider[]
}> {
  try {
    const response = await fetch(`${localApiBase}/api/search?${new URLSearchParams({ q: query })}`, {
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error(`本地采集服务搜索失败：${response.status}`)
    const data = (await response.json()) as { results?: NetworkImageResult[]; providers?: NetworkSearchProvider[] }
    return { mode: 'local', results: data.results ?? [], providers: data.providers ?? [] }
  } catch {
    return {
      mode: 'static',
      results: await searchCommonsImages(query),
      providers: [{ id: 'commons', label: 'Wikimedia Commons fallback', enabled: true }],
    }
  }
}

export async function downloadImageToLocalLibrary(
  imageUrl: string,
  sourceUrl: string,
  title: string,
): Promise<LocalDownloadRecord> {
  const response = await fetch(`${localApiBase}/api/download-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, sourceUrl, title }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `本地下载失败：${response.status}`)
  return data as LocalDownloadRecord
}

export async function resolveImageVariants(imageUrl: string): Promise<NetworkImageResult[]> {
  const response = await fetch(`${localApiBase}/api/resolve-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `大图候选解析失败：${response.status}`)
  return data.results ?? []
}

export async function fetchPageImages(pageUrl: string): Promise<NetworkImageResult[]> {
  const response = await fetch(`${localApiBase}/api/fetch-page-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: pageUrl }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `页面解析失败：${response.status}`)
  return data.results ?? []
}

interface CommonsSearchResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number
        title: string
        imageinfo?: Array<{
          url?: string
          thumburl?: string
          descriptionurl?: string
          width?: number
          height?: number
          mime?: string
          extmetadata?: {
            LicenseShortName?: { value?: string }
          }
        }>
      }
    >
  }
}

export async function searchCommonsImages(query: string): Promise<NetworkImageResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${trimmed}`,
    gsrnamespace: '6',
    gsrlimit: '24',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '700',
    format: 'json',
    origin: '*',
  })

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`)
  if (!response.ok) throw new Error(`Wikimedia Commons 搜索失败：${response.status}`)
  const data = (await response.json()) as CommonsSearchResponse
  const pages = Object.values(data.query?.pages ?? {})

  const results: NetworkImageResult[] = []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info?.url) continue
    results.push({
      id: `commons-${page.pageid}`,
      title: page.title.replace(/^File:/, ''),
      sourceName: 'Wikimedia Commons',
      pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      imageUrl: info.url,
      thumbUrl: info.thumburl ?? info.url,
      width: info.width,
      height: info.height,
      license: info.extmetadata?.LicenseShortName?.value,
      mimeType: info.mime,
    })
  }
  return results
}

export function buildExternalSearchLinks(query: string) {
  const q = encodeURIComponent(query.trim())
  return [
    { label: 'Google Images', url: `https://www.google.com/search?tbm=isch&q=${q}` },
    { label: 'Bing Images', url: `https://www.bing.com/images/search?q=${q}` },
    { label: 'Pinterest', url: `https://www.pinterest.com/search/pins/?q=${q}` },
    { label: 'Steam', url: `https://store.steampowered.com/search/?term=${q}` },
    { label: 'PlayStation Blog', url: `https://blog.playstation.com/?s=${q}` },
    { label: 'Xbox Wire', url: `https://news.xbox.com/en-us/?s=${q}` },
    { label: 'Nintendo News', url: `https://www.nintendo.com/us/search/#q=${q}` },
  ]
}
