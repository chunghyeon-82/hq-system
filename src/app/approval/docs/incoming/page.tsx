'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenIncomingDocs } from '@/lib/db'
import type { IncomingDoc } from '@/types'
import { Search, ChevronRight, FileInput } from 'lucide-react'

export default function IncomingDocsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<IncomingDoc[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    return listenIncomingDocs(user.uid, setDocs)
  }, [user, loading, router])

  const thisYear = new Date().getFullYear()
  const isThisYear = (d: unknown) => {
    try { return ((d as {toDate?:()=>Date}).toDate?.() ?? new Date(d as string)).getFullYear() === thisYear }
    catch { return false }
  }

  const filtered = docs
    .filter(d => d.authorUid === user?.uid && d.status === 'approved' && isThisYear(d.createdAt))
    .filter(d => !query || d.title.includes(query) || d.sender?.includes(query) || d.docNo?.includes(query))
    .sort((a,b) => ((b.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0)-((a.createdAt as {toDate?:()=>Date}).toDate?.()?.getTime()??0))

  const formatDate = (d: unknown) => {
    try { return (d as {toDate?:()=>Date}).toDate?.()?.toLocaleDateString('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit'}) ?? '' } catch { return '' }
  }

  return (
    <ApprovalShell title="수신 공문 목록">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">수신 공문 목록</h2>
            <p className="text-xs text-gray-400 mt-0.5">{thisYear}년 접수 완료 공문</p>
          </div>
          <button onClick={() => router.push('/approval/incoming/new')}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-800 transition-colors">
            <FileInput size={15}/> 공문 접수
          </button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="제목, 발신기관, 문서번호로 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
            <span className="col-span-1">번호</span>
            <span className="col-span-5">제목</span>
            <span className="col-span-3">발신기관</span>
            <span className="col-span-2">문서번호</span>
            <span className="col-span-1 text-right">수신일</span>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">수신 공문이 없습니다</div>
          ) : filtered.map((d, i) => (
            <button key={d.id} onClick={() => router.push(`/approval/incoming/${d.id}`)}
              className="w-full grid grid-cols-12 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left text-sm">
              <span className="col-span-1 text-gray-400">{filtered.length - i}</span>
              <span className="col-span-5 font-medium text-gray-900 truncate pr-2">{d.title}</span>
              <span className="col-span-3 text-gray-500 truncate pr-2">{d.sender || '-'}</span>
              <span className="col-span-2 text-gray-400 text-xs truncate">{d.docNo || '-'}</span>
              <span className="col-span-1 text-gray-400 text-xs text-right">{d.receivedAt?.replace(/-/g,'.')}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-right">총 {filtered.length}건</p>
      </div>
    </ApprovalShell>
  )
}
