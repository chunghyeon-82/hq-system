import { supabase } from './supabase'

const BUCKET = 'approvals'

/**
 * Supabase Storage에 첨부파일 업로드
 * 한글/특수문자 파일명은 타임스탬프_확장자 형태로 변환
 */
export async function uploadAttachment(
  file: File,
  uid: string
): Promise<{ path: string; url: string; size: number }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  // 파일명에서 영문/숫자만 추출, 한글 등 비ASCII 제거
  const baseName = file.name
    .replace(/\.[^.]+$/, '')           // 확장자 제거
    .replace(/[^a-zA-Z0-9_-]/g, '')    // 영문/숫자/_/-만 허용
    .slice(0, 30)                       // 최대 30자
  const safeName = (baseName || 'file') + '_' + Date.now() + '.' + ext
  const path = `${uid}/${safeName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) throw new Error(`업로드 실패: ${error.message}`)

  // 서명된 URL 생성 (3년 유효 — 공문 보존기간)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 3)

  if (signedError || !signedData) throw new Error(`URL 생성 실패: ${signedError?.message}`)

  return { path, url: signedData.signedUrl, size: file.size }
}

/**
 * Supabase Storage에서 파일 삭제
 */
export async function deleteAttachment(path: string): Promise<void> {
  const filePath = path.includes('/object/sign/') || path.includes('/object/public/')
    ? extractPathFromUrl(path)
    : path

  if (!filePath) return

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath])

  if (error) console.error('파일 삭제 실패:', error.message)
}

/**
 * 만료된 서명 URL 갱신
 */
export async function refreshSignedUrl(
  path: string,
  expiresIn = 60 * 60 * 24 * 365 * 3
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error || !data) throw new Error(`URL 갱신 실패: ${error?.message}`)
  return data.signedUrl
}

function extractPathFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const match = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/approvals\/(.+)/)
    return match ? match[1] : ''
  } catch {
    return ''
  }
}

/**
 * 이미지 파일 압축 (500KB 초과 시)
 */
export function compressImage(file: File, maxPx = 1200): Promise<File> {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        0.8
      )
    }
    img.src = URL.createObjectURL(file)
  })
}
