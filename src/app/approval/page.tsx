'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, deleteApprovalDoc } from '@/lib/db'
import type { ApprovalDoc } from '@/types'
import { Plus, FileText, ChevronRight, Clock, Copy } from 'lucide-react'
import clsx from 'clsx'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:    { label: '임시저장', color: 'bg-gray-100 text-gray-600' },
  pending:  { label: '결재중',   color: 'bg-blue-100 text-blue-700' },
  approved: { label: '결재완료', color: 'bg-green-100 text-green-700' },
  rejected: { label: '반려',     color: 'bg-red-100 text-red-700' },
}

type TabType = 'mine' | 'pending' | 'viewer'

export default function ApprovalPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<ApprovalDoc[]>([])
  const [tab,  setTab]  = useState<TabType>('mine')

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

  const myDocs      = docs.filter(d => d.authorUid === user?.uid)
  const draftDocs   = myDocs.filter(d => d.status === 'draft')
  const recentDocs  = myDocs.filter(d => d.status !== 'draft')
    .sort((a, b) => {
      const ta = (a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime() ?? 0
      const tb = (b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime() ?? 0
      return tb - ta
    }).slice(0, 10)

  const pendingDocs = docs.filter(d =>
    d.status === 'pending' && (
      d.approvers?.some(a => a.uid === user?.uid && a.status === 'waiting' &&
        [...(d.approvers ?? [])].slice(0, d.approvers?.findIndex(x => x.uid === a.uid) ?? 0)
          .every(x => x.status === 'submitted' || x.status === 'approved')
      ) ||
      (d.finalApprover?.uid === user?.uid && d.finalApprover?.status === 'waiting' &&
        (d.approvers ?? []).every(a => a.status === 'approved' || a.status === 'submitted'))
    )
  )
  const viewerDocs = docs.filter(d =>
    d.viewers?.some(v => v.uid === user?.uid) && d.status === 'approved'
  )

  const tabDocs = tab === 'mine'
    ? myDocs
    : tab === 'pending'
    ? pendingDocs
    : viewerDocs

  const formatDate = (d: unknown) => {
    if (!d) return ''
    try {
      const ts = (d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)
      return ts.toLocaleDateString('ko-KR', { month:'numeric', day:'numeric' })
    } catch { return '' }
  }

  return (
    <AppShell title="전자결재">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* 상단 탭 + 기안 버튼 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([
              { key: 'mine',    label: `내 문서 ${myDocs.length}` },
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

        {/* 내 문서 탭 - 임시저장 + 최근문서 섹션 */}
        {tab === 'mine' && (
          <>
            {/* 작성 중 (임시저장) */}
            {draftDocs.length > 0 && (
              <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                  <Clock size={13} className="text-amber-500"/>
                  <span className="text-xs font-semibold text-amber-700">작성 중인 문서 ({draftDocs.length})</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {draftDocs.map(doc => (
                    <div key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/approval/${doc.id}`)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.title || '(제목 없음)'}</p>
                        <p className="text-xs text-gray-400">{doc.orgName || ''} · {formatDate(doc.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            router.push(`/approval/new?copyFrom=${doc.id}`)
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-primary-200 text-primary-600 rounded-lg text-xs hover:bg-primary-50 transition-colors">
                          <Copy size={11}/> 이어 작성
                        </button>
                        <button
                          onClick={async e => {
                            e.stopPropagation()
                            if (!confirm('임시저장 문서를 삭제하시겠습니까?')) return
                            await deleteApprovalDoc(doc.id)
                          }}
                          className="text-gray-300 hover:text-red-400 p-1 transition-colors">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 문서 */}
            {recentDocs.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">최근 문서</span>
                  <span className="text-xs text-gray-400">클릭하면 열람 · 양식 재사용 가능</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {recentDocs.map(doc => {
                    const st = STATUS_MAP[doc.status] ?? STATUS_MAP.draft
                    return (
                      <div key={doc.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/approval/${doc.id}`)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', st.color)}>
                              {st.label}
                            </span>
                            {doc.docNo && <span className="text-xs text-gray-400">{doc.docNo}</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                          <p className="text-xs text-gray-400">{doc.orgName} · {formatDate(doc.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* 양식 재사용 */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              if (confirm(`"${doc.title}" 양식으로 새 기안을 작성하시겠습니까?`)) {
                                router.push(`/approval/new?copyFrom=${doc.id}`)
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 hover:border-primary-300 hover:text-primary-600 transition-colors">
                            <Copy size={11}/> 양식 재사용
                          </button>
                          <ChevronRight size={14} className="text-gray-300"/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : draftDocs.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <FileText size={40} className="mx-auto mb-3 opacity-30"/>
                <p className="text-sm">작성한 문서가 없습니다</p>
                <button onClick={() => router.push('/approval/new')}
                  className="mt-4 text-primary-600 text-sm hover:underline">
                  첫 기안 작성하기 →
                </button>
              </div>
            )}
          </>
        )}

        {/* 결재 대기 / 공람 탭 */}
        {tab !== 'mine' && (
          tabDocs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="text-sm">
                {tab === 'pending' ? '결재 대기 문서가 없습니다' : '공람 문서가 없습니다'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tabDocs.map(doc => {
                const st = STATUS_MAP[doc.status] ?? STATUS_MAP.draft
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
                          {doc.docNo && <span className="text-xs text-gray-400">{doc.docNo}</span>}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {doc.drafter?.name} 기안 · {formatDate(doc.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {[doc.drafter, ...doc.approvers, doc.finalApprover].map((a, i) => (
                          <div key={i} className={clsx('w-2 h-2 rounded-full',
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
          )
        )}
      </div>
    </AppShell>
  )
}
