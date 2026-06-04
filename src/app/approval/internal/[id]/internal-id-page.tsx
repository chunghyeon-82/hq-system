'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenInternalDocs, updateInternalDoc, deleteInternalDoc } from '@/lib/db'
import type { InternalDoc } from '@/types'
import { CheckCircle2, XCircle, Trash2, RotateCcw } from 'lucide-react'
import clsx from 'clsx'

const DOC_TYPE_LABEL: Record<string,string> = {
  expense:'지출품의서', purchase:'구매요청서', trip:'출장품의서',
  entertainment:'접대비품의서', general:'일반품의서'
}
const DOC_TYPE_ICON: Record<string,string> = {
  expense:'💰', purchase:'🛒', trip:'✈️', entertainment:'🍽️', general:'📝'
}

export default function InternalDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [docs,    setDocs]    = useState<InternalDoc[]>([])
  const [comment, setComment] = useState('')
  const [acting,  setActing]  = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    return listenInternalDocs(user.uid, setDocs)
  }, [user, loading, router])

  const doc = docs.find(d => d.id === id)
  if (loading || !doc) return (
    <ApprovalShell title="내부 품의서">
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </ApprovalShell>
  )

  const allApprovers = [doc.drafter, ...doc.approvers, doc.finalApprover]

  // 내 차례 판단
  const myMidIdx = doc.approvers?.findIndex(a => a.uid === user?.uid) ?? -1
  const isMidTurn = myMidIdx >= 0 &&
    doc.status === 'pending' &&
    doc.approvers[myMidIdx].status === 'waiting' &&
    [doc.drafter, ...doc.approvers.slice(0, myMidIdx)].every(a => a.status === 'submitted' || a.status === 'approved')
  const isFinalTurn = doc.finalApprover?.uid === user?.uid &&
    doc.finalApprover?.status === 'waiting' &&
    doc.status === 'pending' &&
    doc.approvers.every(a => a.status === 'approved' || a.status === 'submitted')
  const isMyTurn  = isMidTurn || isFinalTurn
  const isAuthor  = doc.authorUid === user?.uid
  const isApproved = doc.status === 'approved'

  const formatDate = (s?: string) => s ? s.replace(/-/g, '.') : ''
  const formatMoney = (n: number) => n?.toLocaleString('ko-KR') ?? '0'
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
      a.uid === user.uid ? { ...a, status: 'approved' as const, actedAt: now, comment, sealUrl } : a
    )
    const finalApprover = doc.finalApprover.uid === user.uid
      ? { ...doc.finalApprover, status: 'approved' as const, actedAt: now, comment, sealUrl }
      : doc.finalApprover

    const isFinalStep = finalApprover.status === 'approved'
    await updateInternalDoc(id, {
      approvers: newApprovers, finalApprover,
      status: isFinalStep ? 'approved' : 'pending',
      approvedAt: isFinalStep ? now : undefined,
    })

    // 다음 결재자 알림
    const nextTarget = isFinalStep ? doc.authorUid :
      newApprovers.every(a => a.status === 'approved' || a.status === 'submitted') ? doc.finalApprover.uid : null
    if (nextTarget) {
      fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
        body: JSON.stringify({
          title: isFinalStep ? '✅ 품의서 결재 완료' : '📋 품의서 결재 요청',
          body: isFinalStep
            ? `"${doc.title}" 품의서가 결재 완료됐습니다`
            : `"${doc.title}" 품의서 결재를 요청합니다`,
          url: '/approval', targetUids: [nextTarget],
        }),
      }).catch(() => {})
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
    await updateInternalDoc(id, { approvers: newApprovers, finalApprover, status: 'rejected', rejectedAt: now })
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
      body: JSON.stringify({
        title: '❌ 품의서 반려',
        body: `"${doc.title}" 품의서가 반려됐습니다. 사유: ${comment}`,
        url: '/approval', targetUids: [doc.authorUid],
      }),
    }).catch(() => {})
    setComment(''); setActing(false)
  }

  const STATUS_COLOR: Record<string,string> = {
    draft: 'bg-gray-100 text-gray-600',
    pending: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const STATUS_LABEL: Record<string,string> = {
    draft:'임시저장', pending:'결재중', approved:'결재완료', rejected:'반려'
  }

  return (
    <ApprovalShell title="내부 품의서">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {/* 상태 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg">{DOC_TYPE_ICON[doc.docType]}</span>
          <span className="text-sm font-medium text-gray-600">{DOC_TYPE_LABEL[doc.docType]}</span>
          <span className={clsx('text-sm font-medium px-3 py-1 rounded-full', STATUS_COLOR[doc.status])}>
            {STATUS_LABEL[doc.status]}
          </span>
          {isAuthor && doc.status === 'draft' && (
            <button onClick={() => router.push(`/approval/internal/new?copyFrom=${id}`)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-medium hover:bg-primary-800">
              이어 작성 →
            </button>
          )}
          {isAuthor && doc.status === 'rejected' && (
            <button onClick={() => router.push(`/approval/internal/new?copyFrom=${id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-medium hover:bg-primary-800">
              <RotateCcw size={12}/> 재작성하기
            </button>
          )}
        </div>

        {/* 품의서 양식 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* 결재란 */}
          <div className="border-b border-gray-200">
            <div className="flex">
              {allApprovers.map((a, i) => (
                <div key={i} className={clsx('flex-1 text-center py-3 px-2 border-r border-gray-200 last:border-0')}>
                  <p className="text-xs text-gray-400 mb-1">{a.role}</p>
                  <div className="h-10 flex items-center justify-center relative">
                    <p className="text-sm font-bold text-gray-900">{a.name}</p>
                    {a.sealUrl && (a.status === 'approved' || a.status === 'submitted') && (
                      <img src={a.sealUrl} alt="도장" style={{position:'absolute',top:'-4px',right:'4px',width:'28px',height:'28px',opacity:0.85,objectFit:'contain'}}/>
                    )}
                  </div>
                  <p className={clsx('text-xs mt-0.5',
                    a.status === 'approved' || a.status === 'submitted' ? 'text-green-600' :
                    a.status === 'rejected' ? 'text-red-500' : 'text-gray-300')}>
                    {a.actedAt ? formatDt(a.actedAt) : '대기'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 본문 */}
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-center text-gray-900 mb-4">{DOC_TYPE_LABEL[doc.docType]}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm border border-gray-200 rounded-xl overflow-hidden">
                {[
                  {label:'부서명', value:doc.dept},
                  {label:'문서번호', value:doc.docNo||'-'},
                  {label:'작성자', value:doc.drafter?.name},
                  {label:'작성일', value:doc.drafter?.actedAt ? formatDt(doc.drafter.actedAt).slice(0,10) : '-'},
                ].map(f => (
                  <div key={f.label} className="flex items-center border-b border-gray-100 last:border-0 px-4 py-2">
                    <span className="text-gray-500 w-20 shrink-0 text-xs font-medium">{f.label}</span>
                    <span className="text-gray-900">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div className="border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-xs text-gray-400 block mb-1">제 목</span>
              <p className="text-base font-bold text-gray-900">{doc.title}</p>
            </div>

            {/* 목적 */}
            {doc.purpose && (
              <div className="border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-xs text-gray-400 block mb-1">목 적</span>
                <p className="text-sm text-gray-800">{doc.purpose}</p>
              </div>
            )}

            {/* 상세 내용 */}
            {doc.content && (
              <div className="border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-xs text-gray-400 block mb-1">내 용</span>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{doc.content}</p>
              </div>
            )}

            {/* 예산 항목 */}
            {doc.budgetItems?.filter(b => b.item).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">예산 내역</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                    <span className="col-span-4">항목</span>
                    <span className="col-span-2 text-center">수량</span>
                    <span className="col-span-3 text-right">단가</span>
                    <span className="col-span-3 text-right">금액</span>
                  </div>
                  {doc.budgetItems.filter(b => b.item).map((b, i) => (
                    <div key={i} className="grid grid-cols-12 px-4 py-2.5 border-b border-gray-50 last:border-0 text-sm">
                      <span className="col-span-4 text-gray-800">{b.item}</span>
                      <span className="col-span-2 text-center text-gray-600">{b.qty}</span>
                      <span className="col-span-3 text-right text-gray-600">{formatMoney(b.unitPrice)}</span>
                      <span className="col-span-3 text-right font-medium text-gray-900">{formatMoney(b.amount)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-12 px-4 py-2.5 bg-primary-50 border-t border-primary-100">
                    <span className="col-span-9 text-sm font-bold text-primary-800">합 계</span>
                    <span className="col-span-3 text-right text-base font-bold text-primary-800">{formatMoney(doc.totalAmount)}원</span>
                  </div>
                </div>
              </div>
            )}

            {/* 지급방법 / 예정일 */}
            {(doc.payMethod || doc.expectedDate) && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {doc.payMethod && (
                  <div className="border border-gray-200 rounded-xl px-4 py-3">
                    <span className="text-xs text-gray-400 block mb-1">지급방법</span>
                    <p className="font-medium text-gray-800">{doc.payMethod}</p>
                  </div>
                )}
                {doc.expectedDate && (
                  <div className="border border-gray-200 rounded-xl px-4 py-3">
                    <span className="text-xs text-gray-400 block mb-1">지급예정일</span>
                    <p className="font-medium text-gray-800">{formatDate(doc.expectedDate)}</p>
                  </div>
                )}
              </div>
            )}

            {/* 기대효과 */}
            {doc.effect && (
              <div className="border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-xs text-gray-400 block mb-1">기대효과 / 비고</span>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{doc.effect}</p>
              </div>
            )}

            {/* 반려 사유 */}
            {doc.status === 'rejected' && (() => {
              const rejector = [...doc.approvers, doc.finalApprover].find(a => a?.status === 'rejected')
              return rejector?.comment ? (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <span className="text-xs text-red-400 block mb-1">반려 사유 ({rejector.name})</span>
                  <p className="text-sm text-red-700">{rejector.comment}</p>
                </div>
              ) : null
            })()}

            {/* 첨부파일 */}
            {doc.attachments?.filter(a => a.url).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-2">첨부파일</p>
                {doc.attachments.filter(a => a.url).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 py-1 text-sm text-primary-600 hover:text-primary-800">
                    📎 {a.name} {a.size && <span className="text-xs text-gray-400">({(a.size/1024).toFixed(0)}KB)</span>}
                  </a>
                ))}
              </div>
            )}
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
                <CheckCircle2 size={16}/> 결재
              </button>
            </div>
          </div>
        )}

        {/* 양식 재사용 */}
        {isApproved && (
          <button onClick={() => { if (confirm(`"${doc.title}" 양식으로 새 품의서를 작성하시겠습니까?`)) router.push(`/approval/internal/new?copyFrom=${id}`) }}
            className="w-full flex items-center justify-center gap-2 py-3 border border-primary-200 text-primary-600 rounded-xl text-sm hover:bg-primary-50 transition-colors">
            📋 이 양식으로 새 품의서 작성
          </button>
        )}

        {/* 삭제 */}
        {isAuthor && (doc.status === 'draft' || doc.status === 'rejected') && (
          <button onClick={async () => {
            if (!confirm('삭제하시겠습니까?')) return
            await deleteInternalDoc(id)
            router.push('/approval')
          }} className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50">
            <Trash2 size={15}/> 삭제
          </button>
        )}
      </div>
    </ApprovalShell>
  )
}
