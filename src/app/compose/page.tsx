'use client'
import { Suspense, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MessengerShell from '@/components/MessengerShell'
import { useAuth } from '@/lib/auth-context'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createClient } from '@supabase/supabase-js'
import { Send, Image, X, Calendar, Lock, Loader2 } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function ComposeContent() {
  const { user } = useAuth()
  const router   = useRouter()

  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [expiresAt,   setExpiresAt]   = useState('')
  const [neverDelete, setNeverDelete] = useState(false)
  const [imageUrls,   setImageUrls]   = useState<string[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const canBroadcast = user?.role === 'ADMIN' ||
    user?.role === 'HQ_CHIEF' ||
    !!user?.permissions?.canBroadcast

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    const uploaded: string[] = []
    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop()
      const path = `broadcasts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('attachments').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('attachments').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
    }
    setImageUrls(prev => [...prev, ...uploaded])
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!user || !canBroadcast) return
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!body.trim())  { setError('내용을 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    try {
      await addDoc(collection(db, 'messages'), {
        type:        'broadcast',
        title:       title.trim(),
        body:        body.trim(),
        imageUrls,
        authorUid:   user.uid,
        authorName:  user.name,
        createdAt:   serverTimestamp(),
        expiresAt:   expiresAt || null,
        neverDelete: neverDelete,
        status:      'open',
      })
      router.push('/')
    } catch (e) {
      setError('등록 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  if (!canBroadcast) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p className="text-sm">전달사항 등록 권한이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3 py-2">
        <button onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm">← 돌아가기</button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">전달사항 등록</h1>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {submitting ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* 제목 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">제목</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="전달사항 제목을 입력하세요"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div>

      {/* 내용 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">내용</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="전달사항 내용을 입력하세요"
          rows={10}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none leading-relaxed"
        />
      </div>

      {/* 이미지 첨부 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">이미지 첨부</label>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden"/>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
          {uploading ? <Loader2 size={15} className="animate-spin"/> : <Image size={15}/>}
          {uploading ? '업로드 중...' : '이미지 선택'}
        </button>
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden aspect-square border border-gray-200">
                <img src={url} alt="" className="w-full h-full object-cover"/>
                <button
                  onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                  <X size={11} className="text-white"/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 게시기한 */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">게시 설정</p>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
            <Calendar size={13}/> 게시기한 (선택)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            disabled={neverDelete}
            min={new Date().toISOString().split('T')[0]}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40 disabled:bg-gray-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            입력 시 해당 날짜 자정에 자동 삭제됩니다
          </p>
        </div>
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={neverDelete}
              onChange={e => { setNeverDelete(e.target.checked); if (e.target.checked) setExpiresAt('') }}
              className="w-4 h-4 rounded accent-primary-600"/>
            <div className="flex items-center gap-1.5">
              <Lock size={13} className="text-gray-500"/>
              <span className="text-sm text-gray-700">삭제 금지 (작성자가 직접 삭제할 때까지 유지)</span>
            </div>
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-6.5">
            체크 시 게시기한을 설정할 수 없습니다
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ComposePage() {
  return (
    <MessengerShell title="전달사항 등록">
      <Suspense>
        <ComposeContent/>
      </Suspense>
    </MessengerShell>
  )
}
