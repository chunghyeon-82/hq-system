'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs } from '@/lib/db'
import type { ApprovalDoc } from '@/types'
import { ChevronRight } from 'lucide-react'

export default function ViewerPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<ApprovalDoc[]>([])
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    return listenApprovalDocs(user.uid, setDocs)
  }, [user, loading, router])

  const viewerDocs = docs.filter(d => d.viewers?.some(v => v.uid === user?.uid) && d.status === 'approved')
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}) ?? '' } catch { return '' }
  }

  return (
    <ApprovalShell title="공람 문서">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">공람 문서</h2>
        {viewerDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">공람 문서가 없습니다</div>
        ) : (
          <div className="space-y-2">
            {viewerDocs.map(d => (
              <button key={d.id} onClick={() => router.push(`/approval/${d.id}`)}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all text-left flex items-center gap-3">
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
