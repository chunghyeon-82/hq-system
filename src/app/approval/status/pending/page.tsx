'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, listenIncomingDocs, listenInternalDocs } from '@/lib/db'
import type { ApprovalDoc, IncomingDoc, InternalDoc } from '@/types'
import { Clock, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

export default function PendingPage() {
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

  const isMyTurn = (d: ApprovalDoc | IncomingDoc | InternalDoc) => {
    if (d.status !== 'pending') return false
    const apprs = d.approvers ?? []
    const myIdx = apprs.findIndex(a => a.uid === user?.uid)
    if (myIdx >= 0 && apprs[myIdx].status === 'waiting') {
      const prev = [('receiver' in d ? d.receiver : (d as ApprovalDoc).drafter), ...apprs.slice(0, myIdx)]
      return prev.every(a => a.status === 'submitted' || a.status === 'approved')
    }
    if (d.finalApprover?.uid === user?.uid && d.finalApprover?.status === 'waiting') {
      return apprs.every(a => a.status === 'approved' || a.status === 'submitted')
    }
    return false
  }

  const pendingDocs = [
    ...docs.filter(isMyTurn).map(d => ({ ...d, docType: 'outgoing' as const })),
    ...incoming.filter(isMyTurn).map(d => ({ ...d, docType: 'incoming' as const })),
    ...internal.filter(isMyTurn).map(d => ({ ...d, docType: 'internal' as const } as unknown as InternalDoc & {docType:'internal'})),
  ].sort((a,b) => {
    const ta = (a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime() ?? 0
    const tb = (b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime() ?? 0
    return tb - ta
  })

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR', {month:'2-digit',day:'2-digit'}) ?? '' }
    catch { return '' }
  }

  return (
    <ApprovalShell title="결재 대기">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-red-500"/>
          <h2 className="text-lg font-bold text-gray-900">결재 대기</h2>
          {pendingDocs.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingDocs.length}</span>
          )}
        </div>
        {pendingDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">결재 대기 문서가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingDocs.map(d => (
              <button key={d.id}
                onClick={() => router.push(d.docType === 'incoming' ? `/approval/incoming/${d.id}` : d.docType === 'internal' ? `/approval/internal/${d.id}` : `/approval/${d.id}`)}
                className="w-full bg-white border border-red-200 rounded-xl p-4 hover:shadow-sm transition-all text-left">
                <div className="flex items-center gap-3">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                    d.docType === 'incoming' ? 'bg-green-100 text-green-700' : d.docType === 'internal' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                    {d.docType === 'incoming' ? '수신' : d.docType === 'internal' ? '품의' : '발신'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {'sender' in d ? (d as IncomingDoc).sender : 'dept' in d ? (d as InternalDoc).dept : (d as ApprovalDoc).orgName} · {formatDate(d.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-red-500 shrink-0 font-medium">결재 필요</span>
                  <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ApprovalShell>
  )
}
