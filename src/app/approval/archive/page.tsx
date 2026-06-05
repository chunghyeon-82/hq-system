'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, listenIncomingDocs, listenInternalDocs } from '@/lib/db'
import type { ApprovalDoc, IncomingDoc, InternalDoc } from '@/types'
import { Search, Archive } from 'lucide-react'
import clsx from 'clsx'

const DOC_TYPE_LABEL: Record<string,string> = {
  expense:'지출결의서', purchase:'구매품의서', trip:'출장신청서',
  entertainment:'접대비품의서', general:'일반품의서'
}

export default function ArchivePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs,         setDocs]         = useState<ApprovalDoc[]>([])
  const [incoming,     setIncoming]     = useState<IncomingDoc[]>([])
  const [internalDocs, setInternalDocs] = useState<InternalDoc[]>([])
  const [tab,  setTab]  = useState<'outgoing'|'incoming'|'internal'>('outgoing')
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [query,setQuery]= useState('')

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const u1 = listenApprovalDocs(user.uid, setDocs)
    const u2 = listenIncomingDocs(user.uid, setIncoming)
    const u3 = listenInternalDocs(user.uid, setInternalDocs)
    return () => { u1(); u2(); u3() }
  }, [user, loading, router])

  const thisYear = new Date().getFullYear()

  const getYear = (d: unknown) => {
    try { return ((d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)).getFullYear() }
    catch { return 0 }
  }

  const allYears = Array.from(new Set([
    ...docs.map(d => getYear(d.createdAt)),
    ...incoming.map(d => getYear(d.createdAt)),
    ...internalDocs.map(d => getYear(d.createdAt)),
  ])).filter(y => y > 0 && y < thisYear).sort((a,b) => b-a)

  const filteredOut = docs
    .filter(d => d.authorUid === user?.uid && d.status === 'approved' && d.isSent === true && getYear(d.createdAt) === year)
    .filter(d => !query || d.title.includes(query) || d.orgName?.includes(query) || d.recipient?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const filteredIn = incoming
    .filter(d => d.authorUid === user?.uid && d.status === 'approved' && getYear(d.createdAt) === year)
    .filter(d => !query || d.title.includes(query) || d.sender?.includes(query) || d.docNo?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const filteredInternal = internalDocs
    .filter(d => d.status === 'approved' && getYear(d.createdAt) < thisYear && getYear(d.createdAt) === year)
    .filter(d => !query || d.title.includes(query) || d.dept?.includes(query) || DOC_TYPE_LABEL[d.docType]?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit'}) ?? '' }
    catch { return '' }
  }
  const formatMoney = (n: number) => n?.toLocaleString('ko-KR') ?? '0'

  const TABS = [
    { key: 'outgoing' as const, label: `보관 발신 (${filteredOut.length})` },
    { key: 'incoming' as const, label: `보관 수신 (${filteredIn.length})` },
    { key: 'internal' as const, label: `보관 품의서 (${filteredInternal.length})` },
  ]

  const current = tab === 'outgoing' ? filteredOut : tab === 'incoming' ? filteredIn : filteredInternal

  return (
    <ApprovalShell title="보관 공문">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Archive size={20} className="text-gray-500"/>
          <h2 className="text-lg font-bold text-gray-900">보관 공문</h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
            {allYears.length === 0
              ? <option value={thisYear-1}>{thisYear-1}년</option>
              : allYears.map(y => <option key={y} value={y}>{y}년</option>)
            }
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  tab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="제목, 기관명, 문서번호로 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
            <span className="col-span-1">번호</span>
            {tab === 'internal' ? (
              <>
                <span className="col-span-2">종류</span>
                <span className="col-span-4">제목</span>
                <span className="col-span-2">부서</span>
                <span className="col-span-2 text-right">금액</span>
                <span className="col-span-1 text-right">날짜</span>
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
              <span className="col-span-1 text-gray-400 text-xs">{current.length - i}</span>
              {tab === 'internal' ? (
                <>
                  <span className="col-span-2">
                    <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                      {DOC_TYPE_LABEL[(d as InternalDoc).docType]}
                    </span>
                  </span>
                  <span className="col-span-4 font-medium text-gray-900 truncate pr-2">{d.title}</span>
                  <span className="col-span-2 text-gray-500 text-xs truncate">{(d as InternalDoc).dept||'-'}</span>
                  <span className="col-span-2 text-right text-gray-700 font-medium text-xs">
                    {(d as InternalDoc).totalAmount ? formatMoney((d as InternalDoc).totalAmount)+'원' : '-'}
                  </span>
                  <span className="col-span-1 text-right text-gray-400 text-xs">{formatDate(d.createdAt)}</span>
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
