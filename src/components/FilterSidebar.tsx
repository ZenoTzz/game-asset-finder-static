import { Filter } from 'lucide-react'
import { assetTypes } from '../lib/presets'
import { ratioOptions } from '../lib/image'
import type { AssetRecord, Filters } from '../types'

interface FilterSidebarProps {
  assets: AssetRecord[]
  filters: Filters
  onChange: (filters: Filters) => void
}

export function FilterSidebar({ assets, filters, onChange }: FilterSidebarProps) {
  const games = Array.from(
    new Set(assets.flatMap((asset) => [asset.gameChinese, asset.gameEnglish].filter(Boolean))),
  ).sort()
  const tags = Array.from(new Set(assets.flatMap((asset) => asset.tags))).sort()

  return (
    <aside className="app-sidebar">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Filter size={16} />
        筛选
      </div>

      <label className="field-label mt-5">
        游戏
        <select
          className="field-input"
          value={filters.game}
          onChange={(event) => onChange({ ...filters, game: event.target.value })}
        >
          <option value="">全部游戏</option>
          {games.map((game) => (
            <option key={game} value={game}>
              {game}
            </option>
          ))}
        </select>
      </label>

      <label className="field-label">
        标签
        <select
          className="field-input"
          value={filters.tag}
          onChange={(event) => onChange({ ...filters, tag: event.target.value })}
        >
          <option value="">全部标签</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>

      <label className="field-label">
        素材类型
        <select
          className="field-input"
          value={filters.assetType}
          onChange={(event) => onChange({ ...filters, assetType: event.target.value as Filters['assetType'] })}
        >
          <option value="all">全部类型</option>
          {assetTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="field-label">
        比例
        <select
          className="field-input"
          value={filters.ratio}
          onChange={(event) => onChange({ ...filters, ratio: event.target.value as Filters['ratio'] })}
        >
          <option value="all">全部比例</option>
          {ratioOptions.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio}
            </option>
          ))}
        </select>
      </label>

      <button
        className="button-secondary mt-3 w-full"
        type="button"
        onClick={() => onChange({ query: '', game: '', tag: '', assetType: 'all', ratio: 'all' })}
      >
        清空筛选
      </button>
    </aside>
  )
}
