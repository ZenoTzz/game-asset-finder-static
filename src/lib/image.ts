import type { CropAreaPixels, RatioCategory } from '../types'

export const ratioOptions: RatioCategory[] = ['16:9', '4:3', '1:1', '3:4', '4:5', 'other']

const targets: Array<[RatioCategory, number]> = [
  ['16:9', 16 / 9],
  ['4:3', 4 / 3],
  ['1:1', 1],
  ['3:4', 3 / 4],
  ['4:5', 4 / 5],
]

export function classifyRatio(width: number, height: number): RatioCategory {
  const ratio = width / height
  const match = targets.find(([, target]) => Math.abs(ratio - target) / target < 0.035)
  return match?.[0] ?? 'other'
}

export async function fileFingerprint(file: File | Blob, name = '') {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `${hash}-${file.size}-${name}`
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片无法加载'))
    image.crossOrigin = 'anonymous'
    image.src = src
  })
}

export async function getImageSize(blob: Blob) {
  const image = await loadImageFromBlob(blob)
  return { width: image.naturalWidth, height: image.naturalHeight }
}

export async function createThumbnail(blob: Blob, maxEdge = 520) {
  const image = await loadImageFromBlob(blob)
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas')
  ctx.drawImage(image, 0, 0, width, height)
  return canvasToBlob(canvas, 'image/jpeg', 0.82)
}

export async function importImageUrl(url: string) {
  const response = await fetch(url, { mode: 'cors' })
  if (!response.ok) throw new Error(`图片请求失败：${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('该 URL 返回的不是图片')
  return blob
}

export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

export async function getCroppedImageBlob(
  imageBlob: Blob,
  crop: CropAreaPixels,
  rotation: number,
  format: 'image/jpeg' | 'image/png',
  quality: number,
) {
  const image = await loadImageFromBlob(imageBlob)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas')

  const rotated = rotateSize(image.naturalWidth, image.naturalHeight, rotation)
  canvas.width = Math.round(rotated.width)
  canvas.height = Math.round(rotated.height)

  ctx.translate(rotated.width / 2, rotated.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2)
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(
    Math.round(crop.x),
    Math.round(crop.y),
    Math.round(crop.width),
    Math.round(crop.height),
  )

  canvas.width = Math.round(crop.width)
  canvas.height = Math.round(crop.height)
  ctx.putImageData(imageData, 0, 0)

  return canvasToBlob(canvas, format, quality)
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'image/jpeg' | 'image/png',
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('图片导出失败'))
      },
      format,
      format === 'image/png' ? undefined : quality,
    )
  })
}
