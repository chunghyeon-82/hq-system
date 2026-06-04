import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

// 이미지 파일을 Firebase Storage에 업로드하고 URL 반환
export async function uploadImage(
  file: File,
  path: string  // 예: 'seals/user123.png'
): Promise<string> {
  // 이미지 압축 (1MB 이하면 그대로)
  let uploadFile = file
  if (file.size > 1024 * 1024) {
    uploadFile = await compressImage(file, 800)
  }
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, uploadFile, { contentType: file.type })
  return await getDownloadURL(storageRef)
}

// 이미지 압축
async function compressImage(file: File, maxSize: number): Promise<File> {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const ctx    = canvas.getContext('2d')!
    const img    = new Image()
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width  = img.width  * ratio
      canvas.height = img.height * ratio
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        resolve(new File([blob!], file.name, { type: 'image/png' }))
      }, 'image/png', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}

export async function deleteImage(url: string) {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch { /* 이미 삭제됐거나 존재하지 않음 */ }
}
