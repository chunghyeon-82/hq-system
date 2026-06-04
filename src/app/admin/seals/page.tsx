'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenOfficialSeals, addOfficialSeal, deleteOfficialSeal } from '@/lib/db'
import { uploadImage } from '@/lib/upload'
import type { OfficialSeal } from '@/types'
import { Plus, Trash2, Upload, Stamp } from 'lucide-react'

export default function SealsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [seals,    setSeals]    = useState<OfficialSeal[]>([])
  const [name,     setName]     = useState('')
  const [file,     setFile]     = useState<File|null>(null)
  const [preview,  setPreview]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loading) return
    if (!user || user.role !== 'ADMIN') { router.replace('/dashboard'); return }
    return listenOfficialSeals(setSeals)
  }, [user, loading, router])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleAdd = async () => {
    if (!user || !name.trim() || !file) return
    setSaving(true)
    try {
      const url = await uploadImage(file, `officialSeals/${user.uid}_${Date.now()}.png`)
      await addOfficialSeal(name.trim(), url, user.uid)
      setName(''); setFile(null); setPreview('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      console.error(e); alert('업로드 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  const handleDelete = async (seal: OfficialSeal) => {
    if (!confirm(`"${seal.name}" 직인을 삭제하시겠습니까?`)) return
    await deleteOfficialSeal(seal.id)
  }

  return (
    <AppShell title="직인 관리" back="/admin">
      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* 직인 추가 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Stamp size={16} className="text-primary-500"/> 직인 추가
          </h2>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">직인 이름 *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 기획운영본부장, 총무부장"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">직인 이미지 *</label>
            <p className="text-xs text-gray-400 mb-2">PNG 형식, 배경 투명 권장 (도장 이미지를 스캔하거나 배경 제거 후 업로드)</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden"/>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors w-full justify-center">
              <Upload size={16}/> 이미지 선택
            </button>
            {preview && (
              <div className="mt-3 flex items-center justify-center p-4 bg-gray-50 rounded-xl">
                <img src={preview} alt="미리보기"
                  className="max-h-24 object-contain"/>
              </div>
            )}
          </div>

          <button onClick={handleAdd} disabled={!name.trim() || !file || saving}
            className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors">
            {saving ? '업로드 중...' : '직인 등록'}
          </button>
        </div>

        {/* 등록된 직인 목록 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">등록된 직인 ({seals.length}개)</h3>
          </div>
          {seals.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">등록된 직인이 없습니다</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {seals.map(seal => (
                <div key={seal.id} className="flex items-center gap-4 px-4 py-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                    <img src={seal.imageUrl} alt={seal.name} className="max-w-full max-h-full object-contain"/>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{seal.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">기관 직인</p>
                  </div>
                  <button onClick={() => handleDelete(seal)}
                    className="p-2 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
