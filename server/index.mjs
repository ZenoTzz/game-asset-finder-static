import cors from 'cors'
import crypto from 'node:crypto'
import 'dotenv/config'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const libraryDir = path.resolve(rootDir, 'library')
const imagesDir = path.resolve(libraryDir, 'images')
const metadataPath = path.resolve(libraryDir, 'metadata.json')
const port = Number(process.env.LOCAL_API_PORT || 8787)

const app = express()
app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] }))
app.use(express.json({ limit: '2mb' }))
app.use('/library/images', express.static(imagesDir))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'local',
    providers: {
      steam: true,
      pageParser: true,
      googleCse: Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX),
      igdb: Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET),
    },
  })
})

app.get('/api/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim()
    if (!query) return res.json({ results: [], providers: [] })

    const batches = await Promise.allSettled([searchSteam(query), searchGoogleCse(query), searchIgdb(query)])
    const providers = []
    const results = []

    for (const batch of batches) {
      if (batch.status === 'fulfilled') {
        providers.push(batch.value.provider)
        results.push(...batch.value.results)
      }
    }

    res.json({
      providers,
      results: dedupeResults(results).sort((a, b) => scoreResult(b) - scoreResult(a)),
    })
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) })
  }
})

app.post('/api/fetch-page-images', async (req, res) => {
  try {
    const pageUrl = requireUrl(req.body?.url)
    const response = await fetch(pageUrl, { headers: defaultHeaders(pageUrl) })
    if (!response.ok) throw new Error(`页面请求失败：${response.status}`)
    const html = await response.text()
    res.json({ results: extractPageImages(html, pageUrl) })
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) })
  }
})

app.post('/api/download-image', async (req, res) => {
  try {
    const imageUrl = requireUrl(req.body?.imageUrl)
    const sourceUrl = String(req.body?.sourceUrl || imageUrl)
    const title = String(req.body?.title || '')
    const response = await fetch(imageUrl, { headers: defaultHeaders(sourceUrl) })
    if (!response.ok) throw new Error(`图片下载失败：${response.status}`)

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) throw new Error(`目标不是图片：${contentType || 'unknown'}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    const ext = extensionFromContentType(contentType) || extensionFromUrl(imageUrl) || 'jpg'
    const fileName = `${hash.slice(0, 16)}.${ext}`
    await fs.mkdir(imagesDir, { recursive: true })
    await fs.writeFile(path.resolve(imagesDir, fileName), buffer)

    const record = {
      id: crypto.randomUUID(),
      title,
      imageUrl,
      sourceUrl,
      localPath: `library/images/${fileName}`,
      localUrl: `http://127.0.0.1:${port}/library/images/${fileName}`,
      contentType,
      size: buffer.length,
      hash,
      createdAt: new Date().toISOString(),
    }
    await appendMetadata(record)
    res.json(record)
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) })
  }
})

app.listen(port, () => {
  console.log(`Game Asset Finder local API listening on http://127.0.0.1:${port}`)
})

async function searchSteam(query) {
  const response = await fetch(`https://store.steampowered.com/api/storesearch/?${new URLSearchParams({
    term: query,
    l: 'english',
    cc: 'US',
  })}`, { headers: defaultHeaders('https://store.steampowered.com') })
  if (!response.ok) throw new Error(`Steam 搜索失败：${response.status}`)
  const data = await response.json()
  const items = Array.isArray(data.items) ? data.items.slice(0, 8) : []
  const details = await Promise.allSettled(items.map(fetchSteamAppMedia))

  return {
    provider: { id: 'steam', label: 'Steam Store', enabled: true },
    results: details.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : [])),
  }
}

async function fetchSteamAppMedia(item) {
  const response = await fetch(`https://store.steampowered.com/api/appdetails?${new URLSearchParams({
    appids: String(item.id),
    filters: 'basic,screenshots,header_image',
    l: 'english',
    cc: 'US',
  })}`, { headers: defaultHeaders('https://store.steampowered.com') })
  if (!response.ok) return []
  const data = await response.json()
  const appData = data?.[item.id]?.data
  if (!appData) return []

  const base = {
    sourceName: 'Steam',
    pageUrl: `https://store.steampowered.com/app/${item.id}`,
    official: true,
    provider: 'steam',
    gameName: appData.name || item.name,
    license: 'Store promotional media',
  }
  const results = []
  if (appData.header_image) {
    results.push(makeResult({ ...base, title: `${base.gameName} header`, imageUrl: appData.header_image }))
  }
  for (const screenshot of appData.screenshots || []) {
    const imageUrl = screenshot.path_full || screenshot.path_thumbnail
    if (imageUrl) results.push(makeResult({ ...base, title: `${base.gameName} screenshot`, imageUrl }))
  }
  return results
}

async function searchGoogleCse(query) {
  const key = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX
  if (!key || !cx) {
    return { provider: { id: 'google-cse', label: 'Google CSE', enabled: false }, results: [] }
  }

  const queries = [
    `${query} official press kit`,
    `${query} official screenshots`,
    `${query} key art site:playstation.com OR site:xbox.com OR site:nintendo.com`,
  ]
  const batches = await Promise.allSettled(queries.map((item) => fetchGoogleImages(item, key, cx)))
  return {
    provider: { id: 'google-cse', label: 'Google Custom Search', enabled: true },
    results: batches.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : [])),
  }
}

async function fetchGoogleImages(query, key, cx) {
  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${new URLSearchParams({
    key,
    cx,
    q: query,
    searchType: 'image',
    num: '10',
    safe: 'off',
  })}`)
  if (!response.ok) throw new Error(`Google CSE 搜索失败：${response.status}`)
  const data = await response.json()
  return (data.items || []).map((item) =>
    makeResult({
      title: item.title || item.displayLink || 'Google image result',
      sourceName: item.displayLink || hostOf(item.image?.contextLink || item.link),
      pageUrl: item.image?.contextLink || item.link,
      imageUrl: item.link,
      width: item.image?.width,
      height: item.image?.height,
      provider: 'google-cse',
      official: isOfficialHost(item.image?.contextLink || item.link),
    }),
  )
}

async function searchIgdb(query) {
  const clientId = process.env.IGDB_CLIENT_ID
  const clientSecret = process.env.IGDB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { provider: { id: 'igdb', label: 'IGDB', enabled: false }, results: [] }
  }

  const token = await getIgdbToken(clientId, clientSecret)
  const response = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: `search "${query.replace(/"/g, '\\"')}"; fields name,cover.image_id,artworks.image_id,screenshots.image_id; limit 8;`,
  })
  if (!response.ok) throw new Error(`IGDB 搜索失败：${response.status}`)
  const games = await response.json()
  const results = []
  for (const game of games) {
    const ids = [
      game.cover?.image_id,
      ...(game.artworks || []).map((item) => item.image_id),
      ...(game.screenshots || []).map((item) => item.image_id),
    ].filter(Boolean)
    for (const imageId of ids) {
      results.push(makeResult({
        title: `${game.name} IGDB media`,
        sourceName: 'IGDB',
        pageUrl: `https://www.igdb.com/games/${encodeURIComponent(game.name || '')}`,
        imageUrl: `https://images.igdb.com/igdb/image/upload/t_original/${imageId}.jpg`,
        provider: 'igdb',
        official: false,
      }))
    }
  }
  return { provider: { id: 'igdb', label: 'IGDB', enabled: true }, results }
}

async function getIgdbToken(clientId, clientSecret) {
  const response = await fetch(`https://id.twitch.tv/oauth2/token?${new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  })}`, { method: 'POST' })
  if (!response.ok) throw new Error(`IGDB token 获取失败：${response.status}`)
  const data = await response.json()
  return data.access_token
}

function extractPageImages(html, pageUrl) {
  const candidates = new Map()
  const add = (rawUrl, title = '') => {
    const imageUrl = absolutize(rawUrl, pageUrl)
    if (!imageUrl || candidates.has(imageUrl)) return
    candidates.set(imageUrl, makeResult({
      title: title || imageUrl.split('/').pop() || 'page image',
      sourceName: hostOf(pageUrl),
      pageUrl,
      imageUrl,
      provider: 'page-parser',
      official: isOfficialHost(pageUrl),
    }))
  }

  for (const match of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>/gi)) add(match[1], 'Open Graph image')
  for (const match of html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)) add(match[1])
  for (const match of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    for (const entry of match[1].split(',').map((item) => item.trim().split(/\s+/)[0]).filter(Boolean)) add(entry)
  }
  return Array.from(candidates.values())
}

function makeResult(input) {
  const imageUrl = input.imageUrl
  return {
    id: crypto.createHash('sha1').update(`${input.provider}:${imageUrl}`).digest('hex'),
    title: input.title,
    sourceName: input.sourceName || hostOf(input.pageUrl || imageUrl),
    pageUrl: input.pageUrl || imageUrl,
    imageUrl,
    thumbUrl: input.thumbUrl || imageUrl,
    width: input.width,
    height: input.height,
    license: input.license,
    mimeType: input.mimeType,
    provider: input.provider,
    official: Boolean(input.official),
  }
}

function dedupeResults(results) {
  const seen = new Set()
  return results.filter((result) => {
    if (!result.imageUrl || seen.has(result.imageUrl)) return false
    seen.add(result.imageUrl)
    return true
  })
}

function scoreResult(result) {
  let score = 0
  if (result.official) score += 100
  if (result.provider === 'steam') score += 60
  if (result.provider === 'google-cse') score += 40
  if (/press|media|kit|screenshot|key/i.test(result.title)) score += 10
  if (result.width && result.height) score += Math.min(20, Math.round((result.width * result.height) / 400000))
  return score
}

function isOfficialHost(url) {
  const host = hostOf(url)
  return /(^|\.)((playstation|xbox|nintendo|steampowered|steamstatic|epicgames|ea|ubisoft|square-enix|capcom|bandainamcoent|sega|bethesda|cdprojektred)\.com|playstation\.blog)$/i.test(host)
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function requireUrl(value) {
  const url = String(value || '').trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('需要有效的 http(s) URL')
  return url
}

function absolutize(value, base) {
  if (!value || value.startsWith('data:')) return ''
  try {
    return new URL(value, base).href
  } catch {
    return ''
  }
}

function defaultHeaders(referer) {
  return {
    'User-Agent': 'Mozilla/5.0 GameAssetFinderLocal/1.0',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    Referer: referer,
  }
}

function extensionFromContentType(contentType) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  return ''
}

function extensionFromUrl(url) {
  const ext = new URL(url).pathname.split('.').pop()?.toLowerCase()
  return ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : ''
}

async function appendMetadata(record) {
  await fs.mkdir(libraryDir, { recursive: true })
  let data = { downloads: [] }
  try {
    data = JSON.parse(await fs.readFile(metadataPath, 'utf8'))
  } catch {
    // First run.
  }
  data.downloads = [record, ...(data.downloads || []).filter((item) => item.hash !== record.hash)]
  await fs.writeFile(metadataPath, JSON.stringify(data, null, 2), 'utf8')
}

function errorMessage(error) {
  return error instanceof Error ? error.message : 'Unknown error'
}
