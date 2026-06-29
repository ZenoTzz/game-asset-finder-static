import type { NetworkImageResult } from '../types'

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
