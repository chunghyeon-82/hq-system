'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenIncomingDocs, updateIncomingDoc, deleteIncomingDoc } from '@/lib/db'
import type { IncomingDoc, Approver } from '@/types'
import { FileText, CheckCircle2, XCircle, Trash2, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

export default function IncomingDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [docs,    setDocs]    = useState<IncomingDoc[]>([])
  const [comment, setComment] = useState('')
  const [acting,  setActing]  = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    return listenIncomingDocs(user.uid, setDocs)
  }, [user, loading, router])

  const doc = docs.find(d => d.id === id)
  if (loading || !doc) return (
    <AppShell title="공문 접수" back="/approval">
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </AppShell>
  )

  const allApprovers = [doc.receiver, ...doc.approvers, doc.finalApprover]

  // 내 차례인지 확인
  const myApproverIdx = doc.approvers?.findIndex(a => a.uid === user?.uid) ?? -1
  const isMidTurn = myApproverIdx >= 0 &&
    doc.status === 'pending' &&
    doc.approvers[myApproverIdx].status === 'waiting' &&
    [doc.receiver, ...doc.approvers.slice(0, myApproverIdx)].every(a => a.status === 'submitted' || a.status === 'approved')
  const isFinalTurn = doc.finalApprover?.uid === user?.uid &&
    doc.finalApprover?.status === 'waiting' &&
    doc.status === 'pending' &&
    doc.approvers.every(a => a.status === 'approved' || a.status === 'submitted')
  const isMyTurn = isMidTurn || isFinalTurn
  const isAuthor = doc.authorUid === user?.uid

  const formatDate = (s?: string) => s ? s.replace(/-/g, '.') : ''
  const formatDt = (s?: string) => {
    if (!s) return ''
    const d = new Date(s)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const handleApprove = async () => {
    if (!user || acting) return
    setActing(true)
    const now = new Date().toISOString()
    const sealUrl = (user as typeof user & {sealUrl?:string}).sealUrl

    const newApprovers = doc.approvers.map(a =>
      a.uid === user.uid ? { ...a, status: 'approved' as const, actedAt: now, comment, ...(sealUrl ? { sealUrl } : {}) } : a
    )
    const finalApprover = doc.finalApprover.uid === user.uid
      ? { ...doc.finalApprover, status: 'approved' as const, actedAt: now, comment, ...(sealUrl ? { sealUrl } : {}) }
      : doc.finalApprover

    const isFinalStep = finalApprover.status === 'approved'
    await updateIncomingDoc(id, {
      approvers: newApprovers, finalApprover,
      status: isFinalStep ? 'approved' : 'pending',
      ...(isFinalStep ? { approvedAt: now } : {}),
    })

    const nextTarget = isFinalStep ? doc.authorUid :
      newApprovers.every(a => a.status === 'approved' || a.status === 'submitted') ? doc.finalApprover.uid : null

    if (nextTarget) {
      fetch('/api/push', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
        body: JSON.stringify({
          title: isFinalStep ? '✅ 공문 접수 완료' : '📨 공문 결재 요청',
          body: isFinalStep
            ? `"${doc.title}" 공문이 접수 완료됐습니다`
            : `"${doc.title}" 공문 결재를 요청합니다`,
          url: '/approval', targetUids: [nextTarget],
        }),
      }).catch(()=>{})
    }
    setComment(''); setActing(false)
  }

  const handleReject = async () => {
    if (!user || acting || !comment.trim()) { alert('반려 사유를 입력해주세요'); return }
    setActing(true)
    const now = new Date().toISOString()
    const newApprovers = doc.approvers.map(a =>
      a.uid === user.uid ? { ...a, status: 'rejected' as const, actedAt: now, comment } : a
    )
    const finalApprover = doc.finalApprover.uid === user.uid
      ? { ...doc.finalApprover, status: 'rejected' as const, actedAt: now, comment }
      : doc.finalApprover

    await updateIncomingDoc(id, { approvers: newApprovers, finalApprover, status: 'rejected', rejectedAt: now })
    fetch('/api/push', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
      body: JSON.stringify({ title:'❌ 공문 반려', body:`"${doc.title}" 공문이 반려됐습니다`, url:'/approval', targetUids:[doc.authorUid] }),
    }).catch(()=>{})
    setComment(''); setActing(false)
  }

  const STATUS_COLOR: Record<string,string> = {
    pending:'bg-blue-100 text-blue-700', approved:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700'
  }
  const STATUS_LABEL: Record<string,string> = { pending:'결재중', approved:'접수완료', rejected:'반려' }

  const isDueSoon = doc.hasDueDate && doc.dueDate && (() => {
    const due = new Date(doc.dueDate + 'T00:00:00')
    const diff = (due.getTime() - Date.now()) / 86400000
    return diff <= 3
  })()

  return (
    <AppShell title="공문 접수" back="/approval">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* 상태 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={clsx('text-sm font-medium px-3 py-1.5 rounded-full', STATUS_COLOR[doc.status] ?? 'bg-gray-100 text-gray-600')}>
            📨 {STATUS_LABEL[doc.status] ?? doc.status}
          </span>
          {doc.hasDueDate && doc.dueDate && (
            <span className={clsx('text-sm px-3 py-1.5 rounded-full', isDueSoon ? 'bg-red-100 text-red-700 font-semibold' : 'bg-amber-50 text-amber-700')}>
              ⏰ 처리기한: {formatDate(doc.dueDate)} {isDueSoon ? '⚠️ 임박' : ''}
            </span>
          )}
        </div>

        {/* 공문 정보 카드 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{doc.title}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">발신기관</span><p className="font-medium text-gray-800 mt-0.5">{doc.sender}</p></div>
            <div><span className="text-gray-400">문서번호</span><p className="font-medium text-gray-800 mt-0.5">{doc.docNo || '-'}</p></div>
            <div><span className="text-gray-400">수신일자</span><p className="font-medium text-gray-800 mt-0.5">{formatDate(doc.receivedAt)}</p></div>
            {doc.hasDueDate && <div><span className="text-gray-400">처리기한</span><p className={clsx('font-medium mt-0.5', isDueSoon ? 'text-red-600' : 'text-gray-800')}>{formatDate(doc.dueDate)}</p></div>}
          </div>
          {doc.memo && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{doc.memo}</div>
          )}
          {doc.pdfUrl && (
            <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-100 transition-colors">
              <FileText size={16}/> {doc.pdfName || '공문 PDF 보기'}
              <ExternalLink size={13} className="ml-auto"/>
            </a>
          )}
        </div>

        {/* 결재선 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">결재 현황</p>
          <div className="flex gap-0 border-t border-gray-300 pt-3">
            {allApprovers.map((a, i) => (
              <div key={i} className={clsx('flex-1 px-3 py-2', i < allApprovers.length-1 && 'border-r border-gray-200')}>
                <p className="text-xs font-bold text-gray-500">{a.role}</p>
                <p className="text-sm font-bold text-gray-900 relative">
                  {a.name}
                  {a.sealUrl && (a.status==='approved'||a.status==='submitted') && (
                    <img src={a.sealUrl} alt="도장" style={{position:'absolute',top:'-8px',right:'-4px',width:'28px',height:'28px',opacity:0.85,objectFit:'contain'}}/>
                  )}
                </p>
                <p className={clsx('text-xs mt-0.5',
                  a.status==='approved'||a.status==='submitted' ? 'text-green-600' :
                  a.status==='rejected' ? 'text-red-500' : 'text-gray-400')}>
                  {a.actedAt ? formatDt(a.actedAt) : '대기중'}
                </p>
                {a.status === 'rejected' && a.comment && (
                  <p className="text-xs text-red-400 mt-1">사유: {a.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 결재 액션 */}
        {isMyTurn && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">결재 처리</h3>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="결재 의견 (반려 시 필수)" rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                <XCircle size={16}/> 반려
              </button>
              <button onClick={handleApprove} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 size={16}/> 접수 확인
              </button>
            </div>
          </div>
        )}

        {/* 삭제 */}
        {isAuthor && doc.status !== 'approved' && (
          <button onClick={async () => {
            if (!confirm('삭제하시겠습니까?')) return
            await deleteIncomingDoc(id)
            router.push('/approval')
          }} className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50">
            <Trash2 size={15}/> 삭제
          </button>
        )}
      </div>
    </AppShell>
  )
}
