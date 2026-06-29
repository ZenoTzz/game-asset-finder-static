export type AssetType =
  | 'cover'
  | 'artwork'
  | 'screenshot'
  | 'logo'
  | 'keyart'
  | 'trailer_thumbnail'
  | 'unknown'

export type RatioCategory = '16:9' | '4:3' | '1:1' | '3:4' | '4:5' | 'other'

export type ExportFormat = 'image/jpeg' | 'image/png'

export interface CropPreset {
  id: string
  label: string
  purpose: string
  ratio: RatioCategory
  aspect: number
}

export interface CropAreaPixels {
  x: number
  y: number
  width: number
  height: number
}

export interface CropRecord {
  id: string
  assetId: string
  presetId: string
  presetLabel: string
  purpose: string
  ratio: RatioCategory
  crop: CropAreaPixels
  zoom: number
  rotation: number
  format: ExportFormat
  quality: number
  exportWidth: number
  exportHeight: number
  createdAt: string
}

export interface AssetRecord {
  id: string
  originalName: string
  mimeType: string
  blob?: Blob
  thumbnail?: Blob
  width: number
  height: number
  aspectRatio: number
  ratioCategory: RatioCategory
  fingerprint: string
  gameChinese: string
  gameEnglish: string
  aliases: string[]
  sourceUrl: string
  assetType: AssetType
  tags: string[]
  notes: string
  crops: CropRecord[]
  missingImage?: boolean
  createdAt: string
  updatedAt: string
}

export interface SourceLinkRecord {
  id: string
  gameKey: string
  gameChinese: string
  gameEnglish: string
  title: string
  url: string
  note: string
  createdAt: string
}

export interface AssetMetadataInput {
  gameChinese: string
  gameEnglish: string
  aliases: string
  sourceUrl: string
  assetType: AssetType
  tags: string
  notes: string
}

export interface Filters {
  query: string
  game: string
  tag: string
  assetType: AssetType | 'all'
  ratio: RatioCategory | 'all'
}

export interface BackupFile {
  version: 1
  exportedAt: string
  assets: Omit<AssetRecord, 'blob' | 'thumbnail'>[]
  sourceLinks: SourceLinkRecord[]
}

export interface NetworkImageResult {
  id: string
  title: string
  sourceName: string
  pageUrl: string
  imageUrl: string
  thumbUrl: string
  width?: number
  height?: number
  license?: string
  mimeType?: string
  provider?: string
  official?: boolean
}

export interface NetworkSearchProvider {
  id: string
  label: string
  enabled: boolean
}

export interface LocalDownloadRecord {
  id: string
  title: string
  imageUrl: string
  sourceUrl: string
  localPath: string
  localUrl: string
  contentType: string
  size: number
  hash: string
  createdAt: string
}
