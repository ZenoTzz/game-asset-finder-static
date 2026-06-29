import type { AssetType, CropPreset } from '../types'

export const assetTypes: AssetType[] = [
  'cover',
  'artwork',
  'screenshot',
  'logo',
  'keyart',
  'trailer_thumbnail',
  'unknown',
]

export const cropPresets: CropPreset[] = [
  { id: 'news-16-9', label: '新闻网站封面 16:9', purpose: 'news_cover', ratio: '16:9', aspect: 16 / 9 },
  { id: 'xhs-3-4', label: '小红书封面 3:4', purpose: 'xiaohongshu_cover', ratio: '3:4', aspect: 3 / 4 },
  { id: 'xhs-4-5', label: '小红书封面 4:5', purpose: 'xiaohongshu_cover', ratio: '4:5', aspect: 4 / 5 },
  { id: 'article-16-9', label: '文章内配图 16:9', purpose: 'article_image', ratio: '16:9', aspect: 16 / 9 },
  { id: 'square-1-1', label: '正方形 1:1', purpose: 'square', ratio: '1:1', aspect: 1 },
]

export const guideOptions = [
  { id: 'none', label: '无参考线' },
  { id: 'topText', label: '上图下文' },
  { id: 'center', label: '主体居中' },
  { id: 'upper', label: '主体偏上' },
  { id: 'bottomSafe', label: '底部标题安全区' },
]
