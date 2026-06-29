import { ExternalLink, Scissors, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { AssetRecord, SourceLinkRecord } from '../types'

interface AssetDetailPanelProps {
  asset?: AssetRecord
  sourceLinks: SourceLinkRecord[]
  onCrop: (asset: AssetRecord) => void
  onDelete: (asset: AssetRecord) => void
  onAddLink: (title: string, url: string, note: string) => void
}

export function AssetDetailPanel({ asset, sourceLinks, onCrop, onDelete, onAddLink }: AssetDetailPanelProps) {
  if (!asset) {
    return (
      <aside className="app-inspector">
        <div className="rounded-md border border-dashed border-white/15 bg-white/[0.04] p-5 text-sm leading-6 text-slate-400">
          选择一张素材后，这里会显示来源、标签、裁切记录和官方资料链接。
        </div>
      </aside>
    )
  }

  return (
    <aside className="app-inspector">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            {asset.gameChinese || asset.gameEnglish || '未命名游戏'}
          </h2>
          <p className="mt-1 break-all text-xs text-slate-400">{asset.originalName}</p>
        </div>
        <button className="icon-button text-rose-600" type="button" onClick={() => onDelete(asset)} aria-label="删除素材">
          <Trash2 size={17} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Info label="尺寸" value={`${asset.width} x ${asset.height}`} />
        <Info label="比例" value={asset.ratioCategory} />
        <Info label="类型" value={asset.assetType} />
        <Info label="裁切版本" value={`${asset.crops.length}`} />
      </div>

      <button className="button-primary mt-4 w-full" type="button" onClick={() => onCrop(asset)} disabled={asset.missingImage}>
        <Scissors size={16} />
        进入裁切
      </button>

      {asset.missingImage ? (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          这条记录来自元数据备份，未包含原图。请重新导入图片后再裁切导出。
        </div>
      ) : null}

      <Section title="素材信息">
        <dl className="space-y-2 text-xs leading-5">
          <Row label="英文名" value={asset.gameEnglish || '-'} />
          <Row label="别名" value={asset.aliases.join(', ') || '-'} />
          <Row label="标签" value={asset.tags.join(', ') || '-'} />
          <Row label="备注" value={asset.notes || '-'} />
          <Row label="来源" value={asset.sourceUrl || '-'} link={asset.sourceUrl} />
        </dl>
      </Section>

      <Section title="官方素材链接">
        <LinkForm onAddLink={onAddLink} />
        <div className="mt-3 space-y-2">
          {sourceLinks.length === 0 ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              暂无链接。可以保存官网、Steam、新闻稿或 press kit 页面。
            </div>
          ) : (
            sourceLinks.map((link) => (
              <a
                key={link.id}
                className="block rounded border border-slate-200 bg-white px-3 py-2 text-xs hover:border-teal-300"
                href={link.url}
                target="_blank"
              >
                <div className="flex items-center justify-between gap-2 font-medium text-slate-800">
                  <span className="truncate">{link.title}</span>
                  <ExternalLink size={13} />
                </div>
                {link.note ? <div className="mt-1 text-slate-500">{link.note}</div> : null}
              </a>
            ))
          )}
        </div>
      </Section>

      <Section title="已保存裁切">
        <div className="space-y-2">
          {asset.crops.length === 0 ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              尚未保存裁切版本。
            </div>
          ) : (
            asset.crops.map((crop) => (
              <div key={crop.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs">
                <div className="font-medium text-slate-800">{crop.presetLabel}</div>
                <div className="mt-1 text-slate-500">
                  {crop.exportWidth} x {crop.exportHeight} · {new Date(crop.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </Section>
    </aside>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.045] p-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 truncate font-semibold text-white">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-400">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Row({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="grid grid-cols-[54px_1fr] gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-all text-slate-800">
        {link ? (
          <a href={link} target="_blank" className="text-teal-700 underline underline-offset-2">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function LinkForm({ onAddLink }: { onAddLink: (title: string, url: string, note: string) => void }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim() || !url.trim()) return
        onAddLink(title.trim(), url.trim(), note.trim())
        setTitle('')
        setUrl('')
        setNote('')
      }}
    >
      <input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="链接标题" />
      <input className="field-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
      <input className="field-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="备注，可选" />
      <button className="button-secondary w-full" type="submit">
        保存链接
      </button>
    </form>
  )
}
