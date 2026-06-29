import { Database, Download, Link, Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AssetDetailPanel } from './components/AssetDetailPanel'
import { AssetGrid } from './components/AssetGrid'
import { CropWorkspace } from './components/CropWorkspace'
import { FilterSidebar } from './components/FilterSidebar'
import { UploadModal } from './components/UploadModal'
import { UrlImportModal } from './components/UrlImportModal'
import { db, getAllAssets, getAllSourceLinks, makeGameKey } from './lib/db'
import { downloadJson, makeBackup } from './lib/export'
import { classifyRatio, createThumbnail, fileFingerprint, getImageSize, importImageUrl } from './lib/image'
import type { AssetMetadataInput, AssetRecord, BackupFile, Filters, SourceLinkRecord } from './types'

const emptyMetadata: AssetMetadataInput = {
  gameChinese: '',
  gameEnglish: '',
  aliases: '',
  sourceUrl: '',
  assetType: 'unknown',
  tags: '',
  notes: '',
}

const emptyFilters: Filters = {
  query: '',
  game: '',
  tag: '',
  assetType: 'all',
  ratio: 'all',
}

function App() {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [sourceLinks, setSourceLinks] = useState<SourceLinkRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [cropAsset, setCropAsset] = useState<AssetRecord | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [metadata, setMetadata] = useState<AssetMetadataInput>(emptyMetadata)
  const [urlModalOpen, setUrlModalOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refreshData()
  }, [])

  useEffect(() => {
    if (!selectedId && assets[0]) setSelectedId(assets[0].id)
  }, [assets, selectedId])

  const selectedAsset = assets.find((asset) => asset.id === selectedId)

  const selectedLinks = useMemo(() => {
    if (!selectedAsset) return []
    const key = makeGameKey(selectedAsset.gameChinese, selectedAsset.gameEnglish)
    return sourceLinks.filter((link) => link.gameKey === key)
  }, [selectedAsset, sourceLinks])

  const filteredAssets = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return assets.filter((asset) => {
      const haystack = [
        asset.gameChinese,
        asset.gameEnglish,
        asset.originalName,
        asset.notes,
        asset.assetType,
        asset.ratioCategory,
        ...asset.aliases,
        ...asset.tags,
      ]
        .join(' ')
        .toLowerCase()

      if (query && !haystack.includes(query)) return false
      if (filters.game && asset.gameChinese !== filters.game && asset.gameEnglish !== filters.game) return false
      if (filters.tag && !asset.tags.includes(filters.tag)) return false
      if (filters.assetType !== 'all' && asset.assetType !== filters.assetType) return false
      if (filters.ratio !== 'all' && asset.ratioCategory !== filters.ratio) return false
      return true
    })
  }, [assets, filters])

  async function refreshData() {
    const [nextAssets, nextLinks] = await Promise.all([getAllAssets(), getAllSourceLinks()])
    setAssets(nextAssets)
    setSourceLinks(nextLinks)
  }

  function openFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setPendingFiles(images)
    setMetadata(emptyMetadata)
    setModalError('')
  }

  async function addFilesToLibrary(files: File[], input: AssetMetadataInput) {
    setBusy(true)
    setModalError('')
    try {
      let imported = 0
      let duplicated = 0
      for (const file of files) {
        const fingerprint = await fileFingerprint(file, file.name)
        const existing = await db.assets.where('fingerprint').equals(fingerprint).first()
        if (existing) {
          duplicated += 1
          continue
        }
        const { width, height } = await getImageSize(file)
        const thumbnail = await createThumbnail(file)
        const now = new Date().toISOString()
        const asset: AssetRecord = {
          id: crypto.randomUUID(),
          originalName: file.name,
          mimeType: file.type || 'image/jpeg',
          blob: file,
          thumbnail,
          width,
          height,
          aspectRatio: width / height,
          ratioCategory: classifyRatio(width, height),
          fingerprint,
          gameChinese: input.gameChinese.trim(),
          gameEnglish: input.gameEnglish.trim(),
          aliases: splitList(input.aliases),
          sourceUrl: input.sourceUrl.trim(),
          assetType: input.assetType,
          tags: splitList(input.tags),
          notes: input.notes.trim(),
          crops: [],
          createdAt: now,
          updatedAt: now,
        }
        await db.assets.add(asset)
        imported += 1
      }
      await refreshData()
      setPendingFiles([])
      setMetadata(emptyMetadata)
      if (duplicated > 0) setModalError(`已导入 ${imported} 张，跳过 ${duplicated} 张重复图片。`)
      return true
    } catch (error) {
      setModalError(error instanceof Error ? error.message : '导入失败')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addUrlImage() {
    if (!imageUrl.trim()) {
      setModalError('请先粘贴图片 URL')
      return
    }
    setBusy(true)
    setModalError('')
    try {
      const blob = await importImageUrl(imageUrl.trim())
      const name = urlFileName(imageUrl.trim(), blob.type)
      const file = new File([blob], name, { type: blob.type })
      const imported = await addFilesToLibrary([file], { ...metadata, sourceUrl: imageUrl.trim() })
      if (imported) {
        setUrlModalOpen(false)
        setImageUrl('')
      }
    } catch (error) {
      setModalError(
        error instanceof Error
          ? `${error.message}。如果是 CORS 限制，请手动下载图片后拖拽上传。`
          : '导入失败。如果是 CORS 限制，请手动下载图片后拖拽上传。',
      )
      setBusy(false)
    }
  }

  async function deleteAsset(asset: AssetRecord) {
    const confirmed = window.confirm(`删除素材「${asset.originalName}」？此操作只影响浏览器本地库。`)
    if (!confirmed) return
    await db.assets.delete(asset.id)
    if (selectedId === asset.id) setSelectedId(undefined)
    await refreshData()
  }

  async function addSourceLink(title: string, url: string, note: string) {
    if (!selectedAsset) return
    const link: SourceLinkRecord = {
      id: crypto.randomUUID(),
      gameKey: makeGameKey(selectedAsset.gameChinese, selectedAsset.gameEnglish),
      gameChinese: selectedAsset.gameChinese,
      gameEnglish: selectedAsset.gameEnglish,
      title,
      url,
      note,
      createdAt: new Date().toISOString(),
    }
    await db.sourceLinks.add(link)
    await refreshData()
  }

  function exportBackup() {
    downloadJson(makeBackup(assets, sourceLinks), `game-asset-finder-backup-${new Date().toISOString().slice(0, 10)}.json`)
  }

  async function importBackup(file: File) {
    const text = await file.text()
    const backup = JSON.parse(text) as BackupFile
    if (backup.version !== 1) throw new Error('不支持的备份版本')
    await db.transaction('rw', db.assets, db.sourceLinks, async () => {
      await db.assets.bulkPut(
        backup.assets.map((asset) => ({
          ...asset,
          blob: undefined,
          thumbnail: undefined,
          missingImage: true,
          updatedAt: new Date().toISOString(),
        })),
      )
      await db.sourceLinks.bulkPut(backup.sourceLinks)
    })
    await refreshData()
  }

  if (cropAsset) {
    return (
      <CropWorkspace
        asset={cropAsset}
        onBack={() => setCropAsset(null)}
        onAssetUpdated={(asset) => {
          setCropAsset(asset)
          setAssets((current) => current.map((item) => (item.id === asset.id ? asset : item)))
        }}
      />
    )
  }

  return (
    <div
      className="min-h-screen bg-slate-100 text-slate-900"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        openFiles(event.dataTransfer.files)
      }}
    >
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2">
          <div className="flex min-w-[190px] items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-700 text-white">
              <Database size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-5">Game Asset Finder</h1>
              <p className="text-xs text-slate-500">静态本地素材库</p>
            </div>
          </div>

          <label className="relative order-last min-w-full flex-1 md:order-none md:min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="h-10 w-full rounded-md border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/10"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder="输入游戏中文名、英文名、别名、关键词"
            />
          </label>

          <input ref={fileInputRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => event.target.files && openFiles(event.target.files)} />
          <input
            ref={backupInputRef}
            className="hidden"
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                await importBackup(file)
              } catch (error) {
                window.alert(error instanceof Error ? error.message : '备份导入失败')
              } finally {
                event.currentTarget.value = ''
              }
            }}
          />

          <button className="button-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            上传
          </button>
          <button className="button-secondary" type="button" onClick={() => setUrlModalOpen(true)}>
            <Link size={16} />
            URL 导入
          </button>
          <button className="button-secondary" type="button" onClick={exportBackup}>
            <Download size={16} />
            备份
          </button>
          <button className="button-secondary" type="button" onClick={() => backupInputRef.current?.click()}>
            恢复
          </button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <FilterSidebar assets={assets} filters={filters} onChange={setFilters} />
        <main className="min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">本地素材库</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredAssets.length} / {assets.length} 张素材。数据保存在当前浏览器 IndexedDB。
              </p>
            </div>
            <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
              可直接拖拽多张图片到页面
            </div>
          </div>
          <AssetGrid assets={filteredAssets} selectedId={selectedId} onSelect={(asset) => setSelectedId(asset.id)} />
        </main>
        <AssetDetailPanel
          asset={selectedAsset}
          sourceLinks={selectedLinks}
          onCrop={(asset) => setCropAsset(asset)}
          onDelete={deleteAsset}
          onAddLink={addSourceLink}
        />
      </div>

      {pendingFiles.length > 0 ? (
        <UploadModal
          title="导入本地图片"
          fileNames={pendingFiles.map((file) => file.name)}
          metadata={metadata}
          busy={busy}
          error={modalError}
          onChange={setMetadata}
          onCancel={() => setPendingFiles([])}
          onSubmit={() => addFilesToLibrary(pendingFiles, metadata)}
        />
      ) : null}

      {urlModalOpen ? (
        <UrlImportModal
          imageUrl={imageUrl}
          metadata={metadata}
          busy={busy}
          error={modalError}
          onUrlChange={setImageUrl}
          onMetadataChange={setMetadata}
          onCancel={() => {
            setUrlModalOpen(false)
            setImageUrl('')
            setModalError('')
          }}
          onSubmit={addUrlImage}
        />
      ) : null}
    </div>
  )
}

function splitList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function urlFileName(url: string, mimeType: string) {
  try {
    const pathName = new URL(url).pathname
    const last = decodeURIComponent(pathName.split('/').filter(Boolean).pop() ?? '')
    if (last && /\.[a-z0-9]+$/i.test(last)) return last
  } catch {
    // Fall through to generated name.
  }
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  return `url-import-${Date.now()}.${ext}`
}

export default App
