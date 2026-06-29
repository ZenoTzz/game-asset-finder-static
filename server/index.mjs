import cors from 'cors'
import crypto from 'node:crypto'
import 'dotenv/config'
import express from 'express'
import fs from 'node:fs/promises'
import { imageSize } from 'image-size'
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
      steamAssetResolver: true,
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

app.post('/api/resolve-image', async (req, res) => {
  try {
    const imageUrl = requireUrl(req.body?.imageUrl)
    const results = await resolveImageVariants(imageUrl)
    res.json({ results: dedupeResults(results).sort((a, b) => scoreResult(b) - scoreResult(a)) })
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) })
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
  const appid = String(item.id)
  const response = await fetch(`https://store.steampowered.com/api/appdetails?${new URLSearchParams({
    appids: appid,
    filters: 'basic,screenshots,header_image,background,background_raw',
    l: 'english',
    cc: 'US',
  })}`, { headers: defaultHeaders('https://store.steampowered.com') })
  if (!response.ok) return []
  const data = await response.json()
  const appData = data?.[appid]?.data
  if (!appData) return []

  const base = {
    sourceName: 'Steam',
    pageUrl: `https://store.steampowered.com/app/${appid}`,
    official: true,
    provider: 'steam',
    gameName: appData.name || item.name,
    license: 'Store promotional media',
  }
  const results = []
  const add = (title, imageUrl, width, height, variant) => {
    if (imageUrl) results.push(makeResult({ ...base, title, imageUrl, width, height, variant }))
  }

  add(`${base.gameName} header`, appData.header_image, 460, 215, 'steam-header')
  add(`${base.gameName} capsule`, appData.capsule_image, 231, 87, 'steam-capsule')
  add(`${base.gameName} background`, appData.background_raw || appData.background, undefined, undefined, 'steam-background')

  for (const sibling of await findSteamSiblingAssets(appid, appData.header_image)) {
    add(`${base.gameName} ${sibling.label}`, sibling.url, sibling.width, sibling.height, sibling.variant)
  }

  for (const screenshot of appData.screenshots || []) {
    const imageUrl = screenshot.path_full || screenshot.path_thumbnail
    add(`${base.gameName} screenshot`, imageUrl, 1920, 1080, 'steam-screenshot')
  }
  return dedupeResults(results)
}

async function resolveImageVariants(imageUrl) {
  const steam = parseSteamAppUrl(imageUrl)
  if (!steam) throw new Error('目前只支持解析 Steam / steamstatic 图片 URL 的大图候选')

  const detailsResponse = await fetch(`https://store.steampowered.com/api/appdetails?${new URLSearchParams({
    appids: steam.appid,
    filters: 'basic,screenshots,header_image,background,background_raw',
    l: 'english',
    cc: 'US',
  })}`, { headers: defaultHeaders('https://store.steampowered.com') })
  const details = detailsResponse.ok ? await detailsResponse.json() : {}
  const appData = details?.[steam.appid]?.data || {}
  const pageUrl = `https://store.steampowered.com/app/${steam.appid}`
  const gameName = appData.name || `Steam App ${steam.appid}`

  const candidates = new Map()
  const add = (url, label, width, height, variant, reason) => {
    if (!url) return
    const normalized = normalizeUrl(url)
    if (!candidates.has(normalized)) candidates.set(normalized, { url: normalized, label, width, height, variant, reason })
  }

  add(imageUrl, '输入图片', undefined, undefined, 'steam-input', '你粘贴的原始 URL')
  add(appData.header_image, '商店头图', 460, 215, 'steam-header', 'Steam appdetails 暴露的 header_image')
  add(appData.capsule_image, '横向胶囊图', 231, 87, 'steam-capsule', 'Steam appdetails 暴露的 capsule_image')
  add(appData.background_raw || appData.background, '商店背景图', undefined, undefined, 'steam-background', 'Steam appdetails 暴露的 background_raw/background')

  for (const sibling of await findSteamSiblingAssets(steam.appid, imageUrl)) {
    add(sibling.url, sibling.label, sibling.width, sibling.height, sibling.variant, '同一 Steam App CDN 目录下可访问的官方素材文件')
  }

  for (const screenshot of appData.screenshots || []) {
    add(screenshot.path_full || screenshot.path_thumbnail, '1920x1080 截图', 1920, 1080, 'steam-screenshot', 'Steam appdetails 暴露的官方截图')
  }

  const enriched = await Promise.all(Array.from(candidates.values()).map(async (candidate) => {
    const info = await fetchImageInfo(candidate.url)
    if (!info.ok) return null
    return makeResult({
      title: `${gameName} ${candidate.label}`,
      sourceName: 'Steam',
      pageUrl,
      imageUrl: candidate.url,
      thumbUrl: candidate.url,
      width: info.width || candidate.width,
      height: info.height || candidate.height,
      mimeType: info.mimeType,
      byteSize: info.byteSize,
      provider: 'steam-resolver',
      official: true,
      license: 'Store promotional media',
      variant: candidate.variant,
      variantReason: candidate.reason,
    })
  }))
  return enriched.filter(Boolean)
}

async function findSteamSiblingAssets(appid, sourceUrl) {
  const parsed = parseSteamAppUrl(sourceUrl)
  const roots = new Set([
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/`,
    `https://store.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/`,
  ])
  if (parsed?.assetDir) roots.add(parsed.assetDir)

  const assetNames = [
    { name: 'capsule_616x353.jpg', label: '616x353 胶囊图', width: 616, height: 353, variant: 'steam-capsule-large' },
    { name: 'library_hero.jpg', label: 'library hero', width: 3840, height: 1240, variant: 'steam-library-hero' },
    { name: 'library_600x900.jpg', label: '竖版 library 封面', width: 600, height: 900, variant: 'steam-library-cover' },
    { name: 'hero_capsule.jpg', label: 'hero capsule', variant: 'steam-hero-capsule' },
    { name: 'page_bg_raw.jpg', label: '原始背景图', variant: 'steam-page-bg-raw' },
    { name: 'page_bg_generated_v6b.jpg', label: '页面背景图', variant: 'steam-page-bg' },
    { name: 'page_bg_generated.jpg', label: '页面背景图', variant: 'steam-page-bg' },
    { name: 'logo.png', label: '透明 logo', variant: 'steam-logo' },
    { name: 'library_logo.png', label: 'library logo', variant: 'steam-library-logo' },
  ]

  const candidates = []
  for (const root of roots) {
    for (const asset of assetNames) {
      candidates.push({ ...asset, url: root + asset.name })
    }
  }

  const probed = await Promise.all(candidates.map(async (candidate) => {
    const info = await fetchImageInfo(candidate.url)
    return info.ok ? { ...candidate, width: info.width || candidate.width, height: info.height || candidate.height } : null
  }))
  return probed.filter(Boolean)
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

async function fetchImageInfo(url) {
  try {
    const response = await fetch(url, {
      headers: {
        ...defaultHeaders(url),
        Range: 'bytes=0-131071',
      },
      redirect: 'follow',
    })
    if (!response.ok && response.status !== 206) return { ok: false }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return { ok: false }
    const byteSize = Number(response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1] || response.headers.get('content-length') || 0) || undefined
    const buffer = Buffer.from(await response.arrayBuffer())
    const dimensions = readImageDimensions(buffer)
    return { ok: true, mimeType: contentType, byteSize, ...dimensions }
  } catch {
    return { ok: false }
  }
}

function readImageDimensions(buffer) {
  try {
    const dimensions = imageSize(buffer)
    return { width: dimensions.width, height: dimensions.height }
  } catch {
    return {}
  }
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
    byteSize: input.byteSize,
    provider: input.provider,
    official: Boolean(input.official),
    variant: input.variant,
    variantReason: input.variantReason,
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
  if (result.provider === 'steam-resolver') score += 70
  if (result.provider === 'steam') score += 60
  if (result.provider === 'google-cse') score += 40
  if (/library hero|background|1920|screenshot|key|art/i.test(`${result.title} ${result.variant || ''}`)) score += 20
  if (/header|capsule_231|steam-input/i.test(`${result.title} ${result.variant || ''}`)) score -= 8
  if (result.width && result.height) score += Math.min(80, Math.round((result.width * result.height) / 100000))
  if (result.byteSize) score += Math.min(25, Math.round(result.byteSize / 100000))
  return score
}

function parseSteamAppUrl(url) {
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/steam\/apps\/(\d+)\/(?:(?<hash>[a-f0-9]{20,})\/)?[^/]+$/i)
    if (!match) return null
    const appid = match[1]
    const assetDir = match.groups?.hash
      ? `${parsed.origin}${parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/') + 1)}`
      : ''
    return { appid, assetDir }
  } catch {
    return null
  }
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    return parsed.href
  } catch {
    return url
  }
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
