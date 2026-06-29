import { ExternalLink, Globe2, ImageDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildExternalSearchLinks, downloadImageToLocalLibrary, fetchPageImages, searchNetworkImages } from '../lib/networkSearch'
import type { NetworkImageResult, NetworkSearchProvider } from '../types'

interface NetworkSearchPanelProps {
  query: string
  onQueryChange: (query: string) => void
  onImportUrl: (url: string, sourceUrl: string, title: string) => void
}

export function NetworkSearchPanel({ query, onQueryChange, onImportUrl }: NetworkSearchPanelProps) {
  const [results, setResults] = useState<NetworkImageResult[]>([])
  const [providers, setProviders] = useState<NetworkSearchProvider[]>([])
  const [mode, setMode] = useState<'local' | 'static' | 'unknown'>('unknown')
  const [pageUrl, setPageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const links = useMemo(() => buildExternalSearchLinks(query || 'game key art'), [query])

  async function runSearch() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await searchNetworkImages(query)
      setMode(response.mode)
      setProviders(response.providers)
      setResults(response.results)
      if (response.mode === 'static') {
        setNotice('本地采集服务未启动，已降级到静态公开源搜索。运行 npm run dev:local 可启用 Steam、Google CSE、IGDB 和本地下载。')
      }
      if (response.results.length === 0) setError('没有找到可导入图片。请尝试英文名、press kit、official screenshots，或配置 Google CSE / IGDB。')
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : '网络搜索失败')
    } finally {
      setBusy(false)
    }
  }

  async function runPageParse() {
    if (!pageUrl.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const next = await fetchPageImages(pageUrl.trim())
      setMode('local')
      setResults(next)
      setProviders([{ id: 'page-parser', label: 'Page parser', enabled: true }])
      if (next.length === 0) setError('这个页面没有提取到图片候选。可能是登录页、强反爬页面，或图片由复杂脚本延迟加载。')
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : '页面解析失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="hero-panel">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-[#53b1ff]">
            <Globe2 size={15} />
            Network discovery
          </div>
          <h2 className="mt-3 text-[35px] font-light leading-tight text-white">本地采集全网官方素材</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            本地 Node 服务会优先搜索 Steam 官方素材，并可通过 .env 启用 Google CSE 与 IGDB。图片下载由本地服务完成，保存到 library/images，再导入浏览器素材库。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="tag-muted">{mode === 'local' ? 'Local API active' : mode === 'static' ? 'Static fallback' : 'Ready'}</span>
            {providers.map((provider) => (
              <span className="tag-muted" key={provider.id}>
                {provider.label}: {provider.enabled ? 'on' : 'off'}
              </span>
            ))}
          </div>
        </div>
        <div className="network-search-box">
          <label className="field-label">
            关键词
            <div className="flex gap-2">
              <input
                className="field-input"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch()
                }}
                placeholder="游戏名 key art screenshot press kit"
              />
              <button className="button-primary shrink-0" type="button" onClick={runSearch} disabled={busy}>
                <Search size={16} />
                {busy ? '搜索中' : '搜索'}
              </button>
            </div>
          </label>
        </div>
      </section>

      {notice ? <div className="notice-warning">{notice}</div> : null}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <label className="field-label">
          解析官方页面 / press kit URL
          <div className="mt-2 flex gap-2">
            <input
              className="field-input"
              value={pageUrl}
              onChange={(event) => setPageUrl(event.target.value)}
              placeholder="https://example.com/press-kit"
            />
            <button className="button-secondary shrink-0" type="button" onClick={runPageParse} disabled={busy}>
              解析页面
            </button>
          </div>
        </label>
      </section>
      <section className="external-links">
        {links.map((link) => (
          <a key={link.label} className="external-link" href={link.url} target="_blank">
            {link.label}
            <ExternalLink size={14} />
          </a>
        ))}
      </section>

      {error ? <div className="notice-warning">{error}</div> : null}

      <section className="masonry-grid">
        {results.map((result) => (
          <article className="network-card" key={result.id}>
            <a className="network-image-frame" href={result.pageUrl} target="_blank" title="打开来源页面">
              <img
                className="h-full w-full object-cover"
                src={result.thumbUrl}
                alt={result.title}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.hidden = true
                }}
              />
              <span className="network-image-fallback">{result.title}</span>
            </a>
            <div className="space-y-3 p-3">
              <div>
                <h3 className="line-clamp-2 text-sm font-semibold text-white">{result.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {result.sourceName}
                  {result.official ? ' · 官方/平台源' : ''}
                  {result.provider ? ` · ${result.provider}` : ''}
                  {result.width && result.height ? ` · ${result.width} x ${result.height}` : ''}
                  {result.license ? ` · ${result.license}` : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="button-primary h-10 px-4 text-xs"
                  type="button"
                  onClick={async () => {
                    setError('')
                    setNotice('')
                    try {
                      const downloaded = await downloadImageToLocalLibrary(result.imageUrl, result.pageUrl, result.title)
                      onImportUrl(downloaded.localUrl, result.pageUrl, result.title)
                      setNotice(`已下载到本地：${downloaded.localPath}`)
                    } catch (downloadError) {
                      setError(downloadError instanceof Error ? downloadError.message : '本地下载失败')
                    }
                  }}
                >
                  <ImageDown size={14} />
                  下载导入
                </button>
                <a className="button-secondary h-10 px-4 text-xs" href={result.imageUrl} target="_blank">
                  原图
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!busy && results.length === 0 && !error ? (
        <div className="empty-state-dark">
          <Globe2 size={34} />
          <h2>输入关键词搜索官方素材和全网图片</h2>
          <p>建议同时尝试英文名、official press kit、key art、screenshot、wallpaper 等关键词。</p>
        </div>
      ) : null}
    </div>
  )
}
