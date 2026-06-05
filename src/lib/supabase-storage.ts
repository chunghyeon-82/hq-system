import { supabase } from './supabase'

const BUCKET = 'approvals'

/**
 * Supabase Storage에 첨부파일 업로드
 * @param file 업로드할 파일
 * @param uid 사용자 UID (폴더 구분용)
 * @returns 파일 경로 (path) — 삭제/다운로드 시 사용
 */
export async function uploadAttachment(
  file: File,
  uid: string
): Promise<{ path: string; url: string; size: number }> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
  const path = `${uid}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
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
 * @param path uploadAttachment에서 반환된 path 값
 */
export async function deleteAttachment(path: string): Promise<void> {
  // URL이 전달된 경우 path 추출
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
 * 만료된 서명 URL 갱신 (필요 시 사용)
 * @param path 파일 경로
 * @param expiresIn 유효시간(초), 기본 3년
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

/**
 * Supabase Storage URL에서 파일 경로 추출
 */
function extractPathFromUrl(url: string): string {
  try {
    const u = new URL(url)
    // /storage/v1/object/sign/approvals/uid/filename 형태
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
