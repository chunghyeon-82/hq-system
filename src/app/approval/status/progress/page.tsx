'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, listenIncomingDocs, listenInternalDocs } from '@/lib/db'
import type { ApprovalDoc, IncomingDoc, InternalDoc } from '@/types'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'

export default function ProgressPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<ApprovalDoc[]>([])
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

  const progressDocs = [
    ...docs.filter(d => d.status === 'pending' && d.authorUid === user?.uid).map(d => ({ ...d, docType: 'outgoing' as const })),
    ...internal.filter(d => d.authorUid === user?.uid).map(d => ({...d, docType:'internal' as const} as unknown as InternalDoc & {docType:'internal'})),
    ...incoming.filter(d => d.status === 'pending' && d.authorUid === user?.uid).map(d => ({ ...d, docType: 'incoming' as const })),
  ].sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0) - ((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}) ?? '' } catch { return '' }
  }
  const getStep = (d: ApprovalDoc | IncomingDoc | InternalDoc) => {
    const all = ['receiver' in d ? d.receiver : (d as ApprovalDoc).drafter, ...d.approvers, d.finalApprover]
    const done = all.filter(a => a.status === 'approved' || a.status === 'submitted').length
    return `${done}/${all.length}`
  }

  return (
    <ApprovalShell title="결재 진행상황">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">결재 진행상황</h2>
        {progressDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">진행 중인 문서가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {progressDocs.map(d => (
              <button key={d.id}
                onClick={() => router.push(d.docType === 'incoming' ? `/approval/incoming/${d.id}` : `/approval/${d.id}`)}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all text-left flex items-center gap-3">
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', d.docType === 'incoming' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                  {d.docType === 'incoming' ? '수신' : '발신'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{'sender' in d ? (d as IncomingDoc).sender : 'dept' in d ? (d as InternalDoc).dept : (d as ApprovalDoc).orgName} · {formatDate(d.createdAt)}</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg shrink-0">{getStep(d)} 결재</span>
                <ChevronRight size={14} className="text-gray-300 shrink-0"/>
              </button>
            ))}
          </div>
        )}
      </div>
    </ApprovalShell>
  )
}
