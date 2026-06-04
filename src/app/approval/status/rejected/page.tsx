'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, listenIncomingDocs, listenInternalDocs } from '@/lib/db'
import type { ApprovalDoc, IncomingDoc, InternalDoc } from '@/types'
import { ChevronRight, RotateCcw } from 'lucide-react'

export default function RejectedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs,     setDocs]     = useState<ApprovalDoc[]>([])
  const [incoming,  setIncoming]  = useState<IncomingDoc[]>([])
  const [internal,  setInternal]  = useState<InternalDoc[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const u1 = listenApprovalDocs(user.uid, setDocs)
    const u2 = listenIncomingDocs(user.uid, setIncoming)
    const u3 = listenInternalDocs(user.uid, setInternal)
    return () => { u1(); u2(); u3() }
  }, [user, loading, router])

  const rejectedDocs = [
    ...docs.filter(d => d.status === 'rejected' && d.authorUid === user?.uid).map(d => ({...d, docType:'outgoing' as const})),
    ...internal.filter(d => d.authorUid === user?.uid).map(d => ({...d, docType:'internal' as const} as unknown as InternalDoc & {docType:'internal'})),
    ...incoming.filter(d => d.status === 'rejected' && d.authorUid === user?.uid).map(d => ({...d, docType:'incoming' as const})),
  ].sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}) ?? '' } catch { return '' }
  }

  // 반려 사유 찾기
  const getRejectReason = (d: ApprovalDoc | IncomingDoc | InternalDoc) => {
    const allApprovers = [
      ...( d.approvers ?? []),
      d.finalApprover,
    ]
    const rejected = allApprovers.find(a => a?.status === 'rejected')
    return rejected?.comment ?? ''
  }

  return (
    <ApprovalShell title="반려 문서">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">반려 문서</h2>

        {rejectedDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">반려된 문서가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {rejectedDocs.map(d => {
              const reason = getRejectReason(d)
              return (
                <div key={d.id} className="bg-white border border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0 mt-0.5">반려</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {'sender' in d ? (d as IncomingDoc).sender : 'dept' in d ? (d as InternalDoc).dept : (d as ApprovalDoc).orgName} · {formatDate(d.createdAt)}
                      </p>
                      {reason && (
                        <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-lg px-3 py-1.5">
                          반려 사유: {reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => router.push(d.docType==='incoming' ? `/approval/incoming/${d.id}` : d.docType==='internal' ? `/approval/internal/${d.id}` : `/approval/${d.id}`)}
                      className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                      문서 보기
                    </button>
                    {d.docType === 'outgoing' && (
                      <button
                        onClick={() => router.push(`/approval/new?copyFrom=${d.id}`)}
                        className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-800 transition-colors flex items-center justify-center gap-1">
                        <RotateCcw size={12}/> 재작성하기
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ApprovalShell>
  )
}
