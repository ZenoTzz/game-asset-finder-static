import type { AssetRecord, BackupFile, CropRecord } from '../types'

export function dateStamp(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}${month}${day}`
}

export function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 90)
}

export function buildExportName(asset: AssetRecord, crop: CropRecord, ext: 'jpg' | 'png') {
  const gameName = asset.gameChinese || asset.gameEnglish || 'unknown_game'
  const base = `${gameName}_${crop.purpose}_${crop.ratio}_${dateStamp()}`
  return `${sanitizeFileName(base)}.${ext}`
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  downloadBlob(blob, fileName)
}

export function makeSourceJson(asset: AssetRecord, crop: CropRecord) {
  return {
    originalName: asset.originalName,
    gameName: asset.gameChinese || asset.gameEnglish,
    gameChinese: asset.gameChinese,
    gameEnglish: asset.gameEnglish,
    sourceUrl: asset.sourceUrl,
    originalWidth: asset.width,
    originalHeight: asset.height,
    cropParams: {
      crop: crop.crop,
      zoom: crop.zoom,
      rotation: crop.rotation,
      preset: crop.presetLabel,
      ratio: crop.ratio,
    },
    exportWidth: crop.exportWidth,
    exportHeight: crop.exportHeight,
    exportTime: crop.createdAt,
    assetType: asset.assetType,
    tags: asset.tags,
  }
}

export function makeBackup(assets: AssetRecord[], sourceLinks: BackupFile['sourceLinks']): BackupFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    assets: assets.map(({ blob: _blob, thumbnail: _thumbnail, ...asset }) => asset),
    sourceLinks,
  }
}
