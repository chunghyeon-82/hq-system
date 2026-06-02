'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessagesForHQ, listenMessagesForBiz } from '@/lib/db'
import type { Message } from '@/types'
import { Search, X, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

export default function SearchPage() {
  const { user, loading }  = useAuth()
  const router    = useRouter()
  const [all,     setAll]     = useState<Message[]>([])
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Message[]>([])

  const isHQ  = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isBiz = user?.role === 'BIZ_REP'

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (isHQ) return listenMessagesForHQ(user.uid, user.role === 'ADMIN', setAll)
    if (isBiz && user.bizId) return listenMessagesForBiz(user.bizId, user.uid, setAll)
  }, [user, isHQ, isBiz, router])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const q = query.toLowerCase()
    setResults(all.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q) ||
      m.authorName.toLowerCase().includes(q)
    ))
  }, [query, all])

  return (
    <AppShell title="메시지 검색">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* 검색창 */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="제목, 내용, 작성자로 검색..."
            autoFocus
            className="w-full border border-gray-300 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={16}/>
            </button>
          )}
        </div>

        {/* 결과 */}
        {query.trim() && (
          <p className="text-xs text-gray-400">{results.length}개 결과</p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map(msg => {
              const q = query.toLowerCase()
              // 하이라이트: 매칭 문장 스니펫
              const bodyIdx = msg.body.toLowerCase().indexOf(q)
              const snippet = bodyIdx >= 0
                ? msg.body.slice(Math.max(0, bodyIdx - 20), bodyIdx + 60)
                : msg.body.slice(0, 60)

              return (
                <button key={msg.id}
                  onClick={() => router.push(`/messages/${msg.id}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-primary-200 transition-all group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={msg.status === 'done' ? 'badge-done' : 'badge-open'}>
                          {msg.status === 'done' ? '완결' : '진행중'}
                        </span>
                        {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                        {msg.type === 'direct' && <span className="badge-received">1:1</span>}
                      </div>
                      <p className="font-medium text-sm text-gray-900 truncate"
                        dangerouslySetInnerHTML={{ __html:
                          msg.title.replace(new RegExp(`(${query})`, 'gi'),
                            '<mark class="bg-yellow-100 text-yellow-800 rounded px-0.5">$1</mark>')
                        }}/>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        ...{snippet}...
                      </p>
                      <p className="text-xs text-gray-300 mt-1">{msg.authorName}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 shrink-0 mt-1"/>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">'{query}'에 대한 결과가 없습니다</p>
          </div>
        )}

        {!query && (
          <div className="text-center py-16 text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">검색어를 입력하세요</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
