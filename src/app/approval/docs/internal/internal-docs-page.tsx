'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenInternalDocs } from '@/lib/db'
import type { InternalDoc } from '@/types'
import { Search } from 'lucide-react'
import clsx from 'clsx'

const DOC_TYPE_LABEL: Record<string,string> = {
  expense:'지출품의서', purchase:'구매요청서', trip:'출장품의서',
  entertainment:'접대비품의서', general:'일반품의서'
}

export default function InternalDocsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs,  setDocs]  = useState<InternalDoc[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    return listenInternalDocs(user.uid, setDocs)
  }, [user, loading, router])

  const thisYear = new Date().getFullYear()
  const getYear = (d: unknown) => {
    try { return ((d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)).getFullYear() }
    catch { return 0 }
  }

  const filtered = docs
    .filter(d => d.status === 'approved' && getYear(d.createdAt) === thisYear)
    .filter(d => !query || d.title.includes(query) || d.dept?.includes(query) || DOC_TYPE_LABEL[d.docType]?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0) - ((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit'}) ?? '' }
    catch { return '' }
  }
  const formatMoney = (n: number) => n?.toLocaleString('ko-KR') ?? '0'

  return (
    <ApprovalShell title="품의서 목록">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">품의서 목록</h2>
          <p className="text-xs text-gray-400 mt-0.5">{thisYear}년 결재 완료 품의서</p>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="제목, 부서명, 품의서 유형으로 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
            <span className="col-span-1 text-center">번호</span>
            <span className="col-span-2">유형</span>
            <span className="col-span-4">제목</span>
            <span className="col-span-2">부서</span>
            <span className="col-span-2 text-right">금액</span>
            <span className="col-span-1 text-right">날짜</span>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">결재 완료된 품의서가 없습니다</div>
          ) : filtered.map((d, i) => (
            <button key={d.id} onClick={() => router.push(`/approval/internal/${d.id}`)}
              className="w-full grid grid-cols-12 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left text-sm items-center">
              <span className="col-span-1 text-center text-gray-400 text-xs">{filtered.length - i}</span>
              <span className="col-span-2">
                <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{DOC_TYPE_LABEL[d.docType]}</span>
              </span>
              <span className="col-span-4 font-medium text-gray-900 truncate pr-2">{d.title}</span>
              <span className="col-span-2 text-gray-500 text-xs truncate">{d.dept || '-'}</span>
              <span className="col-span-2 text-right text-gray-700 font-medium text-xs">{d.totalAmount ? formatMoney(d.totalAmount)+'원' : '-'}</span>
              <span className="col-span-1 text-right text-gray-400 text-xs">{formatDate(d.createdAt)}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-right">총 {filtered.length}건</p>
      </div>
    </ApprovalShell>
  )
}
