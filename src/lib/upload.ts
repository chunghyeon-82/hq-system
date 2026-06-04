import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

// 이미지 파일을 Firebase Storage에 업로드하고 URL 반환
export async function uploadImage(
  file: File,
  path: string,
  removeBg = false  // 도장/직인은 true로
): Promise<string> {
  // 배경 투명처리 (도장/직인)
  let uploadFile = removeBg ? await removeBackground(file) : file
  // 이미지 압축 (1MB 이상)
  if (uploadFile.size > 1024 * 1024) {
    uploadFile = await compressImage(uploadFile, 800)
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

// 흰색/밝은 배경 투명처리 (도장/직인 이미지용)
export async function removeBackground(file: File, threshold = 230): Promise<File> {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const ctx    = canvas.getContext('2d')!
    const img    = new Image()
    img.onload = () => {
      canvas.width  = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2]
        // 밝은 색(흰색/베이지/연회색)이면 투명 처리
        if (r > threshold && g > threshold && b > threshold) {
          // 밝기에 따라 점진적으로 투명도 조절 (경계선 부드럽게)
          const brightness = (r + g + b) / 3
          const alpha = Math.max(0, 255 - ((brightness - threshold) * 3))
          data[i+3] = Math.min(data[i+3], alpha)
        }
      }

      ctx.putImageData(imageData, 0, 0)
      canvas.toBlob(blob => {
        resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' }))
      }, 'image/png')
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
