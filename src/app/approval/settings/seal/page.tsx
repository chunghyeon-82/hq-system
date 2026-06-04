'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { updateUserSeal } from '@/lib/db'
import { uploadImage } from '@/lib/upload'
import { Upload, CheckCircle2 } from 'lucide-react'

export default function SealPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [preview,  setPreview]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const sealUrl = (user as typeof user & {sealUrl?:string}).sealUrl
    if (sealUrl) setPreview(sealUrl)
  }, [user, loading, router])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setSaving(true)
    try {
      const url = await uploadImage(f, `userSeals/${user!.uid}.png`, true)
      await updateUserSeal(user!.uid, url)
      setPreview(url)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch(err) {
      console.error(err); alert('업로드 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <ApprovalShell title="도장 등록">
      <div className="max-w-md mx-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">개인 도장 등록</h2>
          <p className="text-sm text-gray-500 mt-1">전자결재 결재란에 사용됩니다. 업로드 시 배경이 자동 제거됩니다.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          {preview && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-20 h-20 bg-white rounded-xl border border-gray-200 flex items-center justify-center p-2">
                <img src={preview} alt="도장" className="max-w-full max-h-full object-contain"/>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">등록된 도장</p>
                <p className="text-xs text-gray-400 mt-0.5">결재 시 자동으로 서명란에 표시됩니다</p>
                {saved && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={12}/> 저장됐습니다</p>}
              </div>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden"/>
          <button onClick={() => fileRef.current?.click()} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50">
            <Upload size={18}/>
            {saving ? '처리 중...' : preview ? '도장 이미지 변경' : '도장 이미지 업로드'}
          </button>
          <div className="text-xs text-gray-400 space-y-1">
            <p>• PNG, JPG 형식 권장</p>
            <p>• 흰색/밝은 배경 자동 투명 처리</p>
            <p>• 도장 이미지를 스캔하거나 사진 촬영 후 업로드</p>
          </div>
        </div>
      </div>
    </ApprovalShell>
  )
}
