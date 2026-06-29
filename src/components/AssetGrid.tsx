import { ImageOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AssetRecord } from '../types'

interface AssetGridProps {
  assets: AssetRecord[]
  selectedId?: string
  onSelect: (asset: AssetRecord) => void
}

function Thumb({ asset }: { asset: AssetRecord }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!asset.thumbnail && !asset.blob) {
      setUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(asset.thumbnail ?? asset.blob!)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [asset])

  if (!url) {
    return (
      <div className="flex aspect-video items-center justify-center bg-slate-100 text-slate-400">
        <ImageOff size={26} />
      </div>
    )
  }

  return <img className="h-full w-full object-cover" src={url} alt={asset.originalName} />
}

export function AssetGrid({ assets, selectedId, onSelect }: AssetGridProps) {
  const columns = useMemo(() => assets, [assets])

  if (assets.length === 0) {
    return (
      <div className="empty-state-dark">
        <div className="max-w-sm text-center">
          <ImageOff className="mx-auto text-slate-400" size={34} />
          <h2 className="mt-3 text-base font-semibold text-white">还没有匹配的素材</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">拖拽图片到页面，或通过图片 URL 导入后再搜索筛选。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="masonry-grid">
      {columns.map((asset) => (
        <button
          key={asset.id}
          type="button"
          className={`asset-card ${selectedId === asset.id ? 'asset-card-selected' : ''}`}
          onClick={() => onSelect(asset)}
        >
          <div className="overflow-hidden rounded-t-2xl bg-[var(--surface)]">
            <Thumb asset={asset} />
          </div>
          <div className="space-y-2 p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {asset.gameChinese || asset.gameEnglish || '未命名游戏'}
                </div>
                <div className="truncate text-xs text-slate-400">{asset.originalName}</div>
              </div>
              <span className="shrink-0 rounded bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium text-teal-700">
                {asset.ratioCategory}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="tag-muted">{asset.assetType}</span>
              {asset.tags.slice(0, 3).map((tag) => (
                <span className="tag-muted" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
