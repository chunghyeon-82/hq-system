'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs } from '@/lib/db'
import type { ApprovalDoc } from '@/types'
import { ChevronRight, Mail } from 'lucide-react'
import clsx from 'clsx'

export default function DonePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<ApprovalDoc[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    return listenApprovalDocs(user.uid, setDocs)
  }, [user, loading, router])

  const doneDocs = docs
    .filter(d => d.status === 'approved' && d.authorUid === user?.uid)
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const pendingSend = doneDocs.filter(d => !d.isSent).length

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}) ?? '' } catch { return '' }
  }

  return (
    <ApprovalShell title="완료 문서">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">완료 문서</h2>
          {pendingSend > 0 && (
            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
              <Mail size={12}/> 발송 대기 {pendingSend}건
            </span>
          )}
        </div>

        {pendingSend > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
            <Mail size={16} className="shrink-0"/>
            결재가 완료된 문서 {pendingSend}건이 발송을 기다리고 있습니다. 문서를 열어 이메일 발송을 진행해주세요.
          </div>
        )}

        {doneDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">완료된 문서가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {doneDocs.map(d => (
              <button key={d.id} onClick={() => router.push(`/approval/${d.id}`)}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all text-left flex items-center gap-3">
                {!d.isSent ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0 flex items-center gap-1">
                    <Mail size={10}/> 발송 대기
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">발송 완료</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.orgName} · {formatDate(d.createdAt)}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 shrink-0"/>
              </button>
            ))}
          </div>
        )}
      </div>
    </ApprovalShell>
  )
}
