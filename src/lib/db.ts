import Dexie, { type Table } from 'dexie'
import type { AssetRecord, SourceLinkRecord } from '../types'

class GameAssetFinderDb extends Dexie {
  assets!: Table<AssetRecord, string>
  sourceLinks!: Table<SourceLinkRecord, string>

  constructor() {
    super('game-asset-finder-static')
    this.version(1).stores({
      assets:
        'id, fingerprint, gameChinese, gameEnglish, assetType, ratioCategory, createdAt, *tags, *aliases',
      sourceLinks: 'id, gameKey, gameChinese, gameEnglish, createdAt',
    })
  }
}

export const db = new GameAssetFinderDb()

export async function getAllAssets() {
  return db.assets.orderBy('createdAt').reverse().toArray()
}

export async function getAllSourceLinks() {
  return db.sourceLinks.orderBy('createdAt').reverse().toArray()
}

export function makeGameKey(gameChinese: string, gameEnglish: string) {
  const key = `${gameChinese || ''}|${gameEnglish || ''}`.trim().toLowerCase()
  return key || 'unknown'
}
