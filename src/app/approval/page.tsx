'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, listenIncomingDocs, listenInternalDocs } from '@/lib/db'
import type { ApprovalDoc, IncomingDoc, InternalDoc } from '@/types'
import { FilePlus, FileInput, Clock, CheckCircle2, Inbox } from 'lucide-react'
import clsx from 'clsx'

export default function ApprovalPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs,     setDocs]     = useState<ApprovalDoc[]>([])
  const [incoming,  setIncoming]  = useState<IncomingDoc[]>([])
  const [internal,  setInternal]  = useState<InternalDoc[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const isHQ = ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)
    if (!isHQ) { router.replace('/dashboard'); return }
    const u1 = listenApprovalDocs(user.uid, setDocs)
    const u2 = listenIncomingDocs(user.uid, setIncoming)
    const u3 = listenInternalDocs(user.uid, setInternal)
    return () => { u1(); u2(); u3() }
  }, [user, loading, router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
    </div>
  )

  const thisYear = new Date().getFullYear()
  const isThisYear = (d: unknown) => {
    try {
      const ts = (d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)
      return ts.getFullYear() === thisYear
    } catch { return false }
  }

  const myDocs     = docs.filter(d => d.authorUid === user?.uid && isThisYear(d.createdAt))
  const myIncoming = incoming.filter(d => d.authorUid === user?.uid && isThisYear(d.createdAt))

  const pendingCount = docs.filter(d =>
    d.status === 'pending' && (
      d.approvers?.some(a => a.uid === user?.uid && a.status === 'waiting') ||
      (d.finalApprover?.uid === user?.uid && d.finalApprover?.status === 'waiting')
    )
  ).length + incoming.filter(d =>
    d.status === 'pending' && (
      d.approvers?.some(a => a.uid === user?.uid && a.status === 'waiting') ||
      (d.finalApprover?.uid === user?.uid && d.finalApprover?.status === 'waiting')
    )
  ).length

  const stats = [
    { label: '결재 대기',   value: pendingCount,                                           color: 'text-red-500',   bg: 'bg-red-50',   icon: Clock,         path: '/approval/status/pending' },
    { label: '발신 공문',   value: myDocs.filter(d => d.status === 'approved').length,     color: 'text-blue-500',  bg: 'bg-blue-50',  icon: FilePlus,      path: '/approval/docs/outgoing' },
    { label: '수신 공문',   value: myIncoming.filter(d => d.status === 'approved').length, color: 'text-green-600', bg: 'bg-green-50', icon: FileInput,     path: '/approval/docs/incoming' },
    { label: '진행 중',     value: docs.filter(d => d.status === 'pending' && d.authorUid === user?.uid).length + internal.filter(d => d.status === 'pending' && d.authorUid === user?.uid).length, color: 'text-amber-500', bg: 'bg-amber-50', icon: Inbox, path: '/approval/status/progress' },
  ]

  const recentDocs = [...docs, ...incoming, ...internal]
    .filter(d => d.authorUid === user?.uid || 
      (d as ApprovalDoc).approvers?.some(a => a.uid === user?.uid) ||
      (d as ApprovalDoc).finalApprover?.uid === user?.uid)
    .sort((a, b) => {
      const ta = (a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime() ?? 0
      const tb = (b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime() ?? 0
      return tb - ta
    }).slice(0, 8)

  const formatDate = (d: unknown) => {
    try {
      const ts = (d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)
      return ts.toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' })
    } catch { return '' }
  }

  return (
    <ApprovalShell title="전자결재">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{thisYear}년 전자결재 현황</h2>
          <p className="text-sm text-gray-500 mt-0.5">{user?.name}님의 결재 현황입니다</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map(s => (
            <button key={s.label} onClick={() => router.push(s.path)}
              className={clsx('rounded-2xl p-4 text-left hover:shadow-md transition-all border', s.bg, 'border-transparent')}>
              <s.icon size={20} className={clsx('mb-2', s.color)}/>
              <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* 바로가기 */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/approval/new')}
            className="flex items-center gap-3 bg-primary-600 text-white px-5 py-4 rounded-2xl hover:bg-primary-800 transition-colors">
            <FilePlus size={20}/>
            <div className="text-left">
              <p className="font-semibold">공문 작성</p>
              <p className="text-xs text-primary-200">새 기안 작성</p>
            </div>
          </button>
          <button onClick={() => router.push('/approval/incoming/new')}
            className="flex items-center gap-3 bg-white border border-primary-200 text-primary-700 px-5 py-4 rounded-2xl hover:bg-primary-50 transition-colors">
            <FileInput size={20}/>
            <div className="text-left">
              <p className="font-semibold">공문 접수</p>
              <p className="text-xs text-primary-400">외부 공문 접수</p>
            </div>
          </button>
        </div>

        {/* 결재 대기 알림 */}
        {pendingCount > 0 && (
          <button onClick={() => router.push('/approval/status/pending')}
            className="w-full flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors">
            <Clock size={18} className="text-red-500 shrink-0"/>
            <p className="text-sm font-medium text-red-700">결재 대기 문서가 <strong>{pendingCount}건</strong> 있습니다</p>
            <span className="ml-auto text-xs text-red-400">확인하기 →</span>
          </button>
        )}

        {/* 최근 문서 */}
        {recentDocs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">최근 문서</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {recentDocs.map((d, i) => {
                const isIncoming = 'sender' in d
                const status = d.status
                return (
                  <button key={i}
                    onClick={() => router.push('dept' in d ? `/approval/internal/${d.id}` : isIncoming ? `/approval/incoming/${d.id}` : `/approval/${d.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full shrink-0 font-medium',
                      'dept' in d ? 'bg-amber-100 text-amber-700' : isIncoming ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                      {'dept' in d ? '품의' : isIncoming ? '수신' : '발신'}
                    </span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full shrink-0',
                      status === 'approved' ? 'bg-green-100 text-green-700' :
                      status === 'rejected' ? 'bg-red-100 text-red-700' :
                      status === 'pending'  ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                      {status === 'approved' ? '완료' : status === 'rejected' ? '반려' : status === 'pending' ? '진행중' : '임시'}
                    </span>
                    <span className="flex-1 text-sm text-gray-900 truncate">{d.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(d.createdAt)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </ApprovalShell>
  )
}
