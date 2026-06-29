import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { ArrowLeft, Download, RotateCcw, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { buildExportName, downloadBlob, downloadJson, makeSourceJson, sanitizeFileName } from '../lib/export'
import { getCroppedImageBlob } from '../lib/image'
import { cropPresets, guideOptions } from '../lib/presets'
import type { AssetRecord, CropAreaPixels, CropRecord, ExportFormat } from '../types'

interface CropWorkspaceProps {
  asset: AssetRecord
  onBack: () => void
  onAssetUpdated: (asset: AssetRecord) => void
}

export function CropWorkspace({ asset, onBack, onAssetUpdated }: CropWorkspaceProps) {
  const [imageUrl, setImageUrl] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [presetId, setPresetId] = useState(cropPresets[0].id)
  const [guide, setGuide] = useState('center')
  const [format, setFormat] = useState<ExportFormat>('image/jpeg')
  const [quality, setQuality] = useState(0.9)
  const [cropPixels, setCropPixels] = useState<CropAreaPixels | null>(null)
  const [message, setMessage] = useState('')

  const preset = useMemo(() => cropPresets.find((item) => item.id === presetId) ?? cropPresets[0], [presetId])

  useEffect(() => {
    if (!asset.blob) return
    const url = URL.createObjectURL(asset.blob)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [asset.blob])

  const reset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setMessage('')
  }

  const makeCropRecord = (): CropRecord | null => {
    if (!cropPixels) return null
    return {
      id: crypto.randomUUID(),
      assetId: asset.id,
      presetId: preset.id,
      presetLabel: preset.label,
      purpose: preset.purpose,
      ratio: preset.ratio,
      crop: cropPixels,
      zoom,
      rotation,
      format,
      quality,
      exportWidth: Math.round(cropPixels.width),
      exportHeight: Math.round(cropPixels.height),
      createdAt: new Date().toISOString(),
    }
  }

  const saveCrop = async () => {
    const record = makeCropRecord()
    if (!record) return
    const updated = { ...asset, crops: [record, ...asset.crops], updatedAt: new Date().toISOString() }
    await db.assets.put(updated)
    onAssetUpdated(updated)
    setMessage('已保存裁切版本')
  }

  const exportCrop = async () => {
    if (!asset.blob) return
    const record = makeCropRecord()
    if (!record) return
    const blob = await getCroppedImageBlob(asset.blob, record.crop, record.rotation, record.format, record.quality)
    const ext = format === 'image/png' ? 'png' : 'jpg'
    const imageName = buildExportName(asset, record, ext)
    downloadBlob(blob, imageName)
    downloadJson(makeSourceJson(asset, record), `${sanitizeFileName(imageName.replace(/\.[^.]+$/, ''))}_source.json`)
    setMessage('已导出图片和 source.json')
  }

  if (!asset.blob || asset.missingImage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">这条素材没有原图，无法裁切。</p>
          <button className="button-primary mt-4" type="button" onClick={onBack}>
            返回素材库
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button className="icon-button" type="button" onClick={onBack} aria-label="返回">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{asset.gameChinese || asset.gameEnglish || '未命名游戏'}</h1>
            <p className="truncate text-xs text-slate-500">{asset.originalName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="button-secondary" type="button" onClick={reset}>
            <RotateCcw size={16} />
            重置
          </button>
          <button className="button-secondary" type="button" onClick={saveCrop}>
            <Save size={16} />
            保存版本
          </button>
          <button className="button-primary" type="button" onClick={exportCrop}>
            <Download size={16} />
            导出
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[280px_1fr_320px] gap-0">
        <aside className="overflow-auto border-r border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">裁切预设</h2>
          <div className="mt-3 space-y-2">
            {cropPresets.map((item) => (
              <button
                key={item.id}
                className={`preset-button ${presetId === item.id ? 'preset-button-active' : ''}`}
                type="button"
                onClick={() => setPresetId(item.id)}
              >
                <span>{item.label}</span>
                <span>{item.ratio}</span>
              </button>
            ))}
          </div>

          <h2 className="mt-6 text-sm font-semibold">小红书构图参考</h2>
          <div className="mt-3 space-y-2">
            {guideOptions.map((item) => (
              <button
                key={item.id}
                className={`preset-button ${guide === item.id ? 'preset-button-active' : ''}`}
                type="button"
                onClick={() => setGuide(item.id)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="relative min-h-0 bg-slate-900">
          {imageUrl ? (
            <>
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={preset.aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={(_area: Area, pixels: Area) => setCropPixels(pixels)}
                showGrid={false}
              />
              <GuideOverlay guide={guide} />
            </>
          ) : null}
        </section>

        <aside className="overflow-auto border-l border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">导出设置</h2>
          <div className="mt-4 space-y-4">
            <label className="field-label">
              缩放
              <input className="w-full accent-teal-700" type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
              <span className="text-xs text-slate-500">{zoom.toFixed(2)}x</span>
            </label>
            <label className="field-label">
              旋转
              <input className="w-full accent-teal-700" type="range" min={-180} max={180} step={1} value={rotation} onChange={(event) => setRotation(Number(event.target.value))} />
              <span className="text-xs text-slate-500">{rotation}°</span>
            </label>
            <label className="field-label">
              格式
              <select className="field-input" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
              </select>
            </label>
            <label className="field-label">
              JPG 质量
              <input className="w-full accent-teal-700" type="range" min={0.5} max={1} step={0.01} value={quality} disabled={format === 'image/png'} onChange={(event) => setQuality(Number(event.target.value))} />
              <span className="text-xs text-slate-500">{Math.round(quality * 100)}%</span>
            </label>
          </div>

          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-6">
            <div className="flex justify-between">
              <span className="text-slate-500">当前比例</span>
              <span className="font-semibold">{preset.ratio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">裁切尺寸</span>
              <span className="font-semibold">
                {cropPixels ? `${Math.round(cropPixels.width)} x ${Math.round(cropPixels.height)}` : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">原图尺寸</span>
              <span className="font-semibold">
                {asset.width} x {asset.height}
              </span>
            </div>
          </div>

          {message ? <div className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</div> : null}

          <h2 className="mt-6 text-sm font-semibold">已保存版本</h2>
          <div className="mt-3 space-y-2">
            {asset.crops.length === 0 ? (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">暂无保存记录。</div>
            ) : (
              asset.crops.map((record) => (
                <div key={record.id} className="rounded border border-slate-200 px-3 py-2 text-xs">
                  <div className="font-medium">{record.presetLabel}</div>
                  <div className="mt-1 text-slate-500">
                    {record.exportWidth} x {record.exportHeight}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}

function GuideOverlay({ guide }: { guide: string }) {
  if (guide === 'none') return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {guide === 'center' ? (
        <>
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/45" />
          <div className="absolute left-0 top-1/2 h-px w-full bg-white/45" />
          <div className="absolute left-1/3 top-0 h-full w-px bg-white/25" />
          <div className="absolute right-1/3 top-0 h-full w-px bg-white/25" />
        </>
      ) : null}
      {guide === 'upper' ? (
        <>
          <div className="absolute left-0 top-[38%] h-px w-full bg-amber-300/70" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/35" />
        </>
      ) : null}
      {guide === 'topText' ? <div className="absolute bottom-0 left-0 h-[34%] w-full border-t border-amber-300/80 bg-amber-300/10" /> : null}
      {guide === 'bottomSafe' ? <div className="absolute bottom-0 left-0 h-[24%] w-full border-t border-amber-300/80 bg-amber-300/10" /> : null}
    </div>
  )
}
