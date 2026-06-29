import { X } from 'lucide-react'
import { assetTypes } from '../lib/presets'
import type { AssetMetadataInput } from '../types'

interface UploadModalProps {
  title: string
  fileNames: string[]
  metadata: AssetMetadataInput
  requireSource?: boolean
  busy?: boolean
  error?: string
  onChange: (metadata: AssetMetadataInput) => void
  onCancel: () => void
  onSubmit: () => void
}

export function UploadModal({
  title,
  fileNames,
  metadata,
  requireSource,
  busy,
  error,
  onChange,
  onCancel,
  onSubmit,
}: UploadModalProps) {
  const update = (key: keyof AssetMetadataInput, value: string) => {
    onChange({ ...metadata, [key]: value })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {fileNames.length} 张图片将使用这组初始信息，之后可以在详情里调整。
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              游戏中文名
              <input
                className="field-input"
                value={metadata.gameChinese}
                onChange={(event) => update('gameChinese', event.target.value)}
                placeholder="例如：黑神话：悟空"
              />
            </label>
            <label className="field-label">
              游戏英文名
              <input
                className="field-input"
                value={metadata.gameEnglish}
                onChange={(event) => update('gameEnglish', event.target.value)}
                placeholder="例如：Black Myth: Wukong"
              />
            </label>
            <label className="field-label sm:col-span-2">
              别名
              <input
                className="field-input"
                value={metadata.aliases}
                onChange={(event) => update('aliases', event.target.value)}
                placeholder="逗号分隔"
              />
            </label>
            <label className="field-label sm:col-span-2">
              来源 URL {requireSource ? <span className="text-rose-600">*</span> : null}
              <input
                className="field-input"
                value={metadata.sourceUrl}
                onChange={(event) => update('sourceUrl', event.target.value)}
                placeholder="游戏官网、Steam、新闻稿或原图地址"
              />
            </label>
            <label className="field-label">
              素材类型
              <select
                className="field-input"
                value={metadata.assetType}
                onChange={(event) => update('assetType', event.target.value)}
              >
                {assetTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              标签
              <input
                className="field-input"
                value={metadata.tags}
                onChange={(event) => update('tags', event.target.value)}
                placeholder="战斗, 角色, 横版"
              />
            </label>
            <label className="field-label sm:col-span-2">
              备注
              <textarea
                className="field-input min-h-24 resize-y"
                value={metadata.notes}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="版权、用途限制、构图说明等"
              />
            </label>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-700">待导入文件</div>
            <div className="mt-2 max-h-72 space-y-2 overflow-auto">
              {fileNames.map((name) => (
                <div key={name} className="truncate rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600">
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? <div className="mx-5 mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button className="button-secondary" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="button-primary" type="button" onClick={onSubmit} disabled={busy}>
            {busy ? '处理中...' : '保存到素材库'}
          </button>
        </div>
      </div>
    </div>
  )
}
