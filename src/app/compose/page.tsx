'use client'
import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MessengerShell from '@/components/MessengerShell'
import { useAuth } from '@/lib/auth-context'
import { uploadAttachment, compressImage } from '@/lib/supabase-storage'
import { addDoc, collection, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Send, ImageIcon, Paperclip, X, Calendar, Lock, Loader2, ArrowLeft, FileText } from 'lucide-react'

interface AttachedFile {
  name: string
  url:  string
  size: number
}

function ComposeContent() {
  const { user }     = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const editId       = searchParams.get('edit')

  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [expiresAt,   setExpiresAt]   = useState('')
  const [neverDelete, setNeverDelete] = useState(false)
  const [images,      setImages]      = useState<string[]>([])
  const [files,       setFiles]       = useState<AttachedFile[]>([])
  const [uploadingImg, setUploadingImg] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  const imgRef  = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canBroadcast = user?.role === 'ADMIN' ||
    user?.role === 'HQ_CHIEF' ||
    !!user?.permissions?.canBroadcast

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (!editId) return
    getDoc(doc(db, 'messages', editId)).then(snap => {
      if (!snap.exists()) return
      const d = snap.data()
      setTitle(d.title ?? '')
      setBody(d.body ?? '')
      setExpiresAt(d.expiresAt ?? '')
      setNeverDelete(d.neverDelete ?? false)
      setImages(d.imageUrls ?? [])
      setFiles(d.attachedFiles ?? [])
    })
  }, [editId])

  // 이미지 삽입
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files
    if (!picked || !user) return
    setUploadingImg(true)
    for (const file of Array.from(picked)) {
      try {
        const compressed = file.size > 500000 ? await compressImage(file) : file
        const { url } = await uploadAttachment(compressed, user.uid)
        setImages(prev => [...prev, url])
      } catch (err) {
        setError('이미지 업로드에 실패했습니다.')
        console.error(err)
      }
    }
    setUploadingImg(false)
    if (imgRef.current) imgRef.current.value = ''
  }

  // 파일 첨부
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files
    if (!picked || !user) return
    setUploadingFile(true)
    for (const file of Array.from(picked)) {
      try {
        const { url } = await uploadAttachment(file, user.uid)
        setFiles(prev => [...prev, { name: file.name, url, size: file.size }])
      } catch (err) {
        setError('파일 업로드에 실패했습니다.')
        console.error(err)
      }
    }
    setUploadingFile(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!user || !canBroadcast) return
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!body.trim())  { setError('내용을 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    try {
      const data = {
        title:         title.trim(),
        body:          body.trim(),
        imageUrls:     images,
        attachedFiles: files,
        expiresAt:     expiresAt || null,
        neverDelete,
      }
      if (editId) {
        await updateDoc(doc(db, 'messages', editId), {
          ...data,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'messages'), {
          ...data,
          type:       'broadcast',
          authorUid:  user.uid,
          authorName: user.name,
          createdAt:  serverTimestamp(),
          status:     'open',
        })
      }
      router.push('/')
    } catch (e) {
      setError('저장 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  if (!canBroadcast) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <p className="text-sm">전달사항 등록 권한이 없습니다.</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      {/* 상단 */}
      <div className="flex items-center gap-3 py-2">
        <button onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18}/>
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          {editId ? '전달사항 수정' : '전달사항 등록'}
        </h1>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {submitting ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}
          {submitting ? '저장 중...' : (editId ? '수정' : '등록')}
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
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="전달사항 제목을 입력하세요"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
      </div>

      {/* 내용 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">내용</label>
        <textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder="전달사항 내용을 입력하세요"
          rows={8}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none leading-relaxed"/>

        {/* 이미지 삽입 미리보기 */}
        {images.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-400">삽입된 이미지 ({images.length}장) — 게시 후 내용에 표시됩니다</p>
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-square border border-gray-200">
                  <img src={url} alt="" className="w-full h-full object-cover"/>
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                    <X size={11} className="text-white"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 이미지/파일 버튼 */}
        <div className="flex gap-2 mt-2">
          <input ref={imgRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden"/>
          <button onClick={() => imgRef.current?.click()} disabled={uploadingImg}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            {uploadingImg ? <Loader2 size={13} className="animate-spin"/> : <ImageIcon size={13}/>}
            이미지 삽입
          </button>
          <input ref={fileRef} type="file" multiple onChange={handleFileUpload} className="hidden"/>
          <button onClick={() => fileRef.current?.click()} disabled={uploadingFile}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            {uploadingFile ? <Loader2 size={13} className="animate-spin"/> : <Paperclip size={13}/>}
            파일 첨부
          </button>
        </div>
      </div>

      {/* 첨부파일 목록 */}
      {files.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">첨부파일</label>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                <FileText size={16} className="text-gray-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)}KB</p>
                </div>
                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 게시 설정 */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">게시 설정</p>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
            <Calendar size={13}/> 게시기한 (선택)
          </label>
          <input type="date" value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            disabled={neverDelete}
            min={new Date().toISOString().split('T')[0]}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40 disabled:bg-gray-100"/>
          <p className="text-xs text-gray-400 mt-1">입력 시 해당 날짜 자정에 자동 삭제됩니다</p>
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
