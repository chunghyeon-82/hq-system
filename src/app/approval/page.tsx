'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import {
  listenApprovalDocs, deleteApprovalDoc,
  listenApprovalTemplates
} from '@/lib/db'
import type { ApprovalDoc, ApprovalTemplate } from '@/types'
import { Plus, FileText, Clock, CheckCircle2, XCircle, Eye, Trash2 } from 'lucide-react'
import clsx from 'clsx'

const STATUS_MAP = {
  draft:    { label: '임시저장', color: 'bg-gray-100 text-gray-600' },
  pending:  { label: '결재중',   color: 'bg-blue-100 text-blue-700' },
  approved: { label: '결재완료', color: 'bg-green-100 text-green-700' },
  rejected: { label: '반려',     color: 'bg-red-100 text-red-700' },
}

type TabType = 'mine' | 'pending' | 'viewer'

export default function ApprovalPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs,      setDocs]      = useState<ApprovalDoc[]>([])
  const [tab,       setTab]       = useState<TabType>('mine')

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const isHQ = ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)
    if (!isHQ) { router.replace('/dashboard'); return }
    return listenApprovalDocs(user.uid, setDocs)
  }, [user, loading, router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
    </div>
  )

  const mineDocs    = docs.filter(d => d.authorUid === user?.uid)
  const pendingDocs = docs.filter(d =>
    d.status === 'pending' && (
      d.approvers?.some(a => a.uid === user?.uid && a.status === 'waiting') ||
      (d.finalApprover?.uid === user?.uid && d.finalApprover?.status === 'waiting')
    )
  )
  const viewerDocs  = docs.filter(d =>
    d.viewers?.some(v => v.uid === user?.uid) && d.status === 'approved'
  )

  const tabDocs = tab === 'mine' ? mineDocs : tab === 'pending' ? pendingDocs : viewerDocs

  const formatDate = (d: unknown) => {
    if (!d) return ''
    try {
      const ts = (d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)
      return ts.toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' })
    } catch { return '' }
  }

  return (
    <AppShell title="품의서">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* 상단 버튼 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([
              { key: 'mine',    label: `내 문서 ${mineDocs.length}` },
              { key: 'pending', label: `결재 대기 ${pendingDocs.length}`, badge: pendingDocs.length > 0 },
              { key: 'viewer',  label: `공람 ${viewerDocs.length}` },
            ] as { key: TabType; label: string; badge?: boolean }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors relative',
                  tab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {t.label}
                {t.badge && tab !== t.key && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"/>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => router.push('/approval/new')}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-800 transition-colors">
            <Plus size={16}/> 기안 작성
          </button>
        </div>

        {/* 문서 목록 */}
        {tabDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">
              {tab === 'mine'    ? '작성한 품의서가 없습니다' :
               tab === 'pending' ? '결재 대기 문서가 없습니다' : '공람 문서가 없습니다'}
            </p>
            {tab === 'mine' && (
              <button onClick={() => router.push('/approval/new')}
                className="mt-4 text-primary-600 text-sm hover:underline">
                첫 품의서 작성하기 →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tabDocs.map(doc => {
              const st = STATUS_MAP[doc.status]
              return (
                <div key={doc.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => router.push(`/approval/${doc.id}`)}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', st.color)}>
                          {st.label}
                        </span>
                        {doc.docNo && (
                          <span className="text-xs text-gray-400">{doc.docNo}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {doc.orgName} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    {/* 결재 단계 표시 */}
                    <div className="flex items-center gap-1 shrink-0">
                      {[doc.drafter, ...doc.approvers, doc.finalApprover].map((a, i) => (
                        <div key={i} className={clsx(
                          'w-2 h-2 rounded-full',
                          a.status === 'approved' || a.status === 'submitted' ? 'bg-green-400' :
                          a.status === 'rejected' ? 'bg-red-400' :
                          a.status === 'waiting'  ? 'bg-blue-300' : 'bg-gray-200'
                        )}/>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
