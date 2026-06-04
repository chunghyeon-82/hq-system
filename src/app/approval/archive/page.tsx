'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, listenIncomingDocs, listenInternalDocs } from '@/lib/db'
import type { ApprovalDoc, IncomingDoc, InternalDoc } from '@/types'
import { Search, Archive } from 'lucide-react'
import clsx from 'clsx'

export default function ArchivePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs,     setDocs]     = useState<ApprovalDoc[]>([])
  const [incoming, setIncoming] = useState<IncomingDoc[]>([])
  const [tab,      setTab]      = useState<'outgoing'|'incoming'|'internal'>('outgoing')
  const [year,     setYear]     = useState(new Date().getFullYear() - 1)
  const [query,    setQuery]    = useState('')
  const [internalDocs, setInternalDocs] = useState<InternalDoc[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const u1 = listenApprovalDocs(user.uid, setDocs)
    const u2 = listenIncomingDocs(user.uid, setIncoming)
    const u3 = listenInternalDocs(user.uid, setInternalDocs)
    return () => { u1(); u2(); u3() }
  }, [user, loading, router])

  const thisYear = new Date().getFullYear()

  // 과거 연도 목록 추출
  const allYears = Array.from(new Set([
    ...docs.map(d => {
      try { return ((d.createdAt as {toDate?:()=>Date}).toDate?.() ?? new Date(d.createdAt as string)).getFullYear() }
      catch { return 0 }
    }),
    ...incoming.map(d => {
      try { return ((d.createdAt as {toDate?:()=>Date}).toDate?.() ?? new Date(d.createdAt as string)).getFullYear() }
      catch { return 0 }
    }),
  ])).filter(y => y > 0 && y < thisYear).sort((a,b) => b-a)

  const getYear = (d: unknown) => {
    try { return ((d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)).getFullYear() }
    catch { return 0 }
  }

  const DOC_TYPE_LABEL: Record<string,string> = {
    expense:'지출품의서', purchase:'구매요청서', trip:'출장품의서',
    entertainment:'접대비품의서', general:'일반품의서'
  }

  const filteredInternal = internalDocs
    .filter(d => d.status === 'approved' && getYear(d.createdAt) === year)
    .filter(d => !query || d.title.includes(query) || d.dept?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const filteredOut = docs
    .filter(d => d.authorUid === user?.uid && d.status === 'approved' && d.isSent === true && getYear(d.createdAt) === year)
    .filter(d => !query || d.title.includes(query) || d.orgName?.includes(query) || d.recipient?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const filteredIn = incoming
    .filter(d => d.authorUid === user?.uid && d.status === 'approved' && getYear(d.createdAt) === year)
    .filter(d => !query || d.title.includes(query) || d.sender?.includes(query) || d.docNo?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit'}) ?? '' } catch { return '' }
  }

  const current = tab === 'outgoing' ? filteredOut : tab === 'incoming' ? filteredIn : filteredInternal

  return (
    <ApprovalShell title="보관 공문">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Archive size={20} className="text-gray-500"/>
          <h2 className="text-lg font-bold text-gray-900">보관 공문</h2>
        </div>

        {/* 연도 선택 + 탭 */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
            {allYears.length === 0
              ? <option value={thisYear-1}>{thisYear-1}년</option>
              : allYears.map(y => <option key={y} value={y}>{y}년</option>)
            }
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['outgoing','incoming'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500')}>
                {t === 'outgoing' ? `보관 발신 (${filteredOut.length})` : `보관 수신 (${filteredIn.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="제목, 기관명, 문서번호로 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>

        {/* 목록 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
            <span className="col-span-1">번호</span>
            {tab === 'internal' ? (
              <>
                <span className="col-span-2">유형</span>
                <span className="col-span-5">제목</span>
                <span className="col-span-2">부서</span>
                <span className="col-span-2 text-right">날짜</span>
              </>
            ) : (
              <>
                <span className="col-span-6">제목</span>
                <span className="col-span-3">{tab==='outgoing' ? '수신처' : '발신기관'}</span>
                <span className="col-span-2 text-right">날짜</span>
              </>
            )}
          </div>
          {current.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {year}년 보관 {tab==='outgoing'?'발신 공문':tab==='incoming'?'수신 공문':'품의서'}이 없습니다
            </div>
          ) : current.map((d, i) => (
            <button key={d.id}
              onClick={() => router.push(
                tab==='incoming' ? `/approval/incoming/${d.id}` :
                tab==='internal' ? `/approval/internal/${d.id}` :
                `/approval/${d.id}`
              )}
              className="w-full grid grid-cols-12 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left text-sm items-center">
              <span className="col-span-1 text-gray-400">{current.length - i}</span>
              {tab === 'internal' ? (
                <>
                  <span className="col-span-2 text-xs">
                    <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                      {DOC_TYPE_LABEL[(d as InternalDoc).docType]}
                    </span>
                  </span>
                  <span className="col-span-5 font-medium text-gray-900 truncate pr-2">{d.title}</span>
                  <span className="col-span-2 text-gray-500 text-xs truncate">{(d as InternalDoc).dept||'-'}</span>
                  <span className="col-span-2 text-gray-400 text-xs text-right">{formatDate(d.createdAt)}</span>
                </>
              ) : (
                <>
                  <span className="col-span-6 font-medium text-gray-900 truncate pr-2">{d.title}</span>
                  <span className="col-span-3 text-gray-500 truncate pr-2">
                    {tab==='outgoing' ? (d as ApprovalDoc).recipient : (d as IncomingDoc).sender}
                  </span>
                  <span className="col-span-2 text-gray-400 text-xs text-right">{formatDate(d.createdAt)}</span>
                </>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-right">총 {current.length}건</p>
      </div>
    </ApprovalShell>
  )
}
