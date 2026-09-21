'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import MessengerShell from '@/components/MessengerShell'
import { useAuth } from '@/lib/auth-context'
import { listenChatRooms, listenChatRoomMessages } from '@/lib/db'
import type { ChatRoom, ChatMessage } from '@/lib/db'
import { Search, X, MessageSquare, Hash } from 'lucide-react'

interface SearchResult {
  room: ChatRoom
  message: ChatMessage
}

export default function SearchPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [rooms,   setRooms]   = useState<ChatRoom[]>([])
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const allMessages = useRef<Map<string, ChatMessage[]>>(new Map())

  useEffect(() => {
    if (loading || !user) return
    return listenChatRooms(user.uid, setRooms)
  }, [user, loading])

  const handleSearch = async () => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    const q = query.toLowerCase()
    const found: SearchResult[] = []

    for (const room of rooms) {
      const cached = allMessages.current.get(room.id)
      if (cached) {
        cached.filter(m => m.body.toLowerCase().includes(q))
          .forEach(m => found.push({ room, message: m }))
      }
    }
    setResults(found)
    setSearching(false)
  }

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(handleSearch, 400)
    return () => clearTimeout(timer)
  }, [query, rooms])

  const getRoomName = (room: ChatRoom) => {
    if (room.type === 'direct' && user) {
      return room.members.find(m => m.uid !== user.uid)?.name ?? room.name
    }
    return room.name
  }

  function formatTime(ts: unknown): string {
    if (!ts) return ''
    const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
    if (!d || isNaN(d.getTime())) return ''
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <MessengerShell title="채팅 검색">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="채팅 메시지 검색..."
            autoFocus
            className="w-full border border-gray-300 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={16}/>
            </button>
          )}
        </div>

        {query.trim() && (
          <p className="text-xs text-gray-400">{results.length}개 결과</p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r, i) => {
              const q = query.toLowerCase()
              const idx = r.message.body.toLowerCase().indexOf(q)
              const snippet = r.message.body.slice(Math.max(0, idx - 20), idx + 80)
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-200 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${r.room.type === 'group' ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700'}`}>
                      {r.room.type === 'group' ? <Hash size={11}/> : getRoomName(r.room)[0]}
                    </div>
                    <span className="text-xs font-medium text-gray-600">{getRoomName(r.room)}</span>
                    <span className="text-xs text-gray-400 ml-auto">{formatTime(r.message.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{r.message.senderName}</p>
                  <p className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html:
                    snippet.replace(new RegExp(`(${query})`, 'gi'),
                      '<mark class="bg-yellow-100 text-yellow-800 rounded px-0.5">$1</mark>')
                  }}/>
                </div>
              )
            })}
          </div>
        )}

        {query.trim() && results.length === 0 && !searching && (
          <div className="text-center py-16 text-gray-400">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">'{query}'에 대한 채팅 결과가 없습니다</p>
          </div>
        )}

        {!query && (
          <div className="text-center py-16 text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">채팅 메시지를 검색하세요</p>
          </div>
        )}
      </div>
    </MessengerShell>
  )
}
