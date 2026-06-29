import { ExternalLink, Globe2, ImageDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildExternalSearchLinks, searchCommonsImages } from '../lib/networkSearch'
import type { NetworkImageResult } from '../types'

interface NetworkSearchPanelProps {
  query: string
  onQueryChange: (query: string) => void
  onImportUrl: (url: string, sourceUrl: string, title: string) => void
}

export function NetworkSearchPanel({ query, onQueryChange, onImportUrl }: NetworkSearchPanelProps) {
  const [results, setResults] = useState<NetworkImageResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const links = useMemo(() => buildExternalSearchLinks(query || 'game key art'), [query])

  async function runSearch() {
    setBusy(true)
    setError('')
    try {
      const next = await searchCommonsImages(query)
      setResults(next)
      if (next.length === 0) setError('没有找到可直接读取的公开图片。可以使用右侧外部搜索入口，再复制原图 URL 导入。')
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : '网络搜索失败')
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
          <h2 className="mt-3 text-[35px] font-light leading-tight text-white">搜索网络公开图片源</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            纯静态站不能绕过登录、反爬或 CORS。这里优先搜索允许浏览器跨域读取的公开图片源；其他站点会作为外部入口打开，由你复制原图 URL 或下载后导入。
          </p>
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
                  {result.width && result.height ? ` · ${result.width} x ${result.height}` : ''}
                  {result.license ? ` · ${result.license}` : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="button-primary h-10 px-4 text-xs"
                  type="button"
                  onClick={() => onImportUrl(result.imageUrl, result.pageUrl, result.title)}
                >
                  <ImageDown size={14} />
                  导入原图
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
          <h2>输入关键词搜索公开图片源</h2>
          <p>建议同时尝试英文名、press kit、key art、screenshot、wallpaper 等关键词。</p>
        </div>
      ) : null}
    </div>
  )
}
