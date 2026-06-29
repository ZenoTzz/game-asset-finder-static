import { Link, X } from 'lucide-react'
import type { AssetMetadataInput } from '../types'

interface UrlImportModalProps {
  imageUrl: string
  metadata: AssetMetadataInput
  busy?: boolean
  error?: string
  onUrlChange: (value: string) => void
  onMetadataChange: (metadata: AssetMetadataInput) => void
  onCancel: () => void
  onSubmit: () => void
}

export function UrlImportModal({
  imageUrl,
  metadata,
  busy,
  error,
  onUrlChange,
  onMetadataChange,
  onCancel,
  onSubmit,
}: UrlImportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border border-white/10 bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Link size={18} className="text-sky-300" />
            <h2 className="text-base font-semibold text-white">通过图片 URL 导入</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="field-label">
            图片 URL
            <input
              className="field-input"
              value={imageUrl}
              onChange={(event) => {
                onUrlChange(event.target.value)
                onMetadataChange({ ...metadata, sourceUrl: event.target.value })
              }}
              placeholder="https://..."
            />
          </label>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            外部站点可能禁止跨域读取图片。遇到 CORS 限制时，请手动下载图片后拖拽上传，并保留来源 URL。
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              游戏中文名
              <input
                className="field-input"
                value={metadata.gameChinese}
                onChange={(event) => onMetadataChange({ ...metadata, gameChinese: event.target.value })}
              />
            </label>
            <label className="field-label">
              游戏英文名
              <input
                className="field-input"
                value={metadata.gameEnglish}
                onChange={(event) => onMetadataChange({ ...metadata, gameEnglish: event.target.value })}
              />
            </label>
            <label className="field-label sm:col-span-2">
              标签
              <input
                className="field-input"
                value={metadata.tags}
                onChange={(event) => onMetadataChange({ ...metadata, tags: event.target.value })}
              />
            </label>
          </div>
          {error ? <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button className="button-secondary" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="button-primary" type="button" onClick={onSubmit} disabled={busy}>
            {busy ? '尝试导入...' : '导入图片'}
          </button>
        </div>
      </div>
    </div>
  )
}
