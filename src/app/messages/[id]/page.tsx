'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MessengerShell from '@/components/MessengerShell'
import { useAuth } from '@/lib/auth-context'
import { listenBroadcastComments, addBroadcastComment, deleteBroadcastComment } from '@/lib/db'
import type { BroadcastComment } from '@/lib/db'
import { db } from '@/lib/firebase'
import { doc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore'
import { Trash2, Edit2, Send, X, ArrowLeft, Lock, Calendar } from 'lucide-react'
import clsx from 'clsx'

function formatTime(ts: unknown): string {
  if (!ts) return ''
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
  if (!d || isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface BroadcastDoc {
  id: string
  title: string
  body: string
  imageUrls?: string[]
  authorUid: string
  authorName: string
  createdAt: unknown
  expiresAt?: string | null
  neverDelete?: boolean
  status: string
}

export default function MessageDetailPage() {
  const { user } = useAuth()
  const params   = useParams()
  const router   = useRouter()
  const id       = params.id as string

  const [broadcast,     setBroadcast]     = useState<BroadcastDoc | null>(null)
  const [comments,      setComments]      = useState<BroadcastComment[]>([])
  const [commentInput,  setCommentInput]  = useState('')
  const [sending,       setSending]       = useState(false)
  const [notFound,      setNotFound]      = useState(false)

  const isAdmin      = user?.role === 'ADMIN'
  const canBroadcast = isAdmin || user?.role === 'HQ_CHIEF' || !!user?.permissions?.canBroadcast
  const canComment   = canBroadcast || !!user?.permissions?.canComment
  const isAuthor     = broadcast?.authorUid === user?.uid

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'messages', id), snap => {
      if (!snap.exists()) { setNotFound(true); return }
      setBroadcast({ id: snap.id, ...snap.data() } as BroadcastDoc)
    })
    return unsub
  }, [id])

  useEffect(() => {
    return listenBroadcastComments(id, setComments)
  }, [id])

  const handleDelete = async () => {
    if (!confirm('이 전달사항을 삭제하시겠습니까?')) return
    await deleteDoc(doc(db, 'messages', id))
    router.back()
  }

  const handleComment = async () => {
    if (!user || !commentInput.trim() || sending) return
    setSending(true)
    await addBroadcastComment(id, user.uid, user.name, commentInput.trim())
    setCommentInput('')
    setSending(false)
  }

  if (notFound) return (
    <MessengerShell title="전달사항">
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p className="text-sm">삭제되었거나 존재하지 않는 게시글입니다.</p>
      </div>
    </MessengerShell>
  )

  if (!broadcast) return (
    <MessengerShell title="전달사항">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"/>
      </div>
    </MessengerShell>
  )

  return (
    <MessengerShell title={broadcast.title}>
      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* 상단 버튼 */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={18}/>
          </button>
          <div className="flex-1"/>
          {(isAdmin || isAuthor) && canBroadcast && (
            <>
              <button onClick={() => router.push(`/compose?edit=${id}`)}
                className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
                <Edit2 size={16}/>
              </button>
              <button onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={16}/>
              </button>
            </>
          )}
        </div>

        {/* 본문 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h1 className="text-lg font-bold text-gray-900 mb-3">{broadcast.title}</h1>
            <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
              <span className="font-medium text-gray-600">{broadcast.authorName}</span>
              <span>·</span>
              <span>{formatTime(broadcast.createdAt)}</span>
              {broadcast.expiresAt && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Calendar size={11}/> {broadcast.expiresAt}까지
                </span>
              )}
              {broadcast.neverDelete && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Lock size={11}/> 삭제금지
                </span>
              )}
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{broadcast.body}</p>
            {broadcast.imageUrls && broadcast.imageUrls.length > 0 && (
              <div className="mt-4 space-y-3">
                {broadcast.imageUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full rounded-xl border border-gray-100"/>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 댓글 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">댓글 {comments.length}개</p>
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
                {c.authorName[0]}
              </div>
              <div className="flex-1 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-800">{c.authorName}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">{formatTime(c.createdAt)}</span>
                    {(isAdmin || c.authorUid === user?.uid) && (
                      <button onClick={() => deleteBroadcastComment(id, c.id)}
                        className="p-0.5 text-gray-300 hover:text-red-400 rounded transition-colors">
                        <X size={11}/>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700">{c.body}</p>
              </div>
            </div>
          ))}

          {canComment ? (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <input value={commentInput} onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment() } }}
                placeholder="댓글을 입력하세요..."
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"/>
              <button onClick={handleComment} disabled={!commentInput.trim() || sending}
                className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-40 transition-colors shrink-0">
                <Send size={13}/>
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">댓글 권한이 없습니다</p>
          )}
        </div>
      </div>
    </MessengerShell>
  )
}
