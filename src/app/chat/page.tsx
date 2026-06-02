'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenChatMessages, sendChatMessage, listenUsers } from '@/lib/db'
import type { ChatMessage } from '@/lib/db'
import type { AppUser } from '@/types'
import { Send, Users } from 'lucide-react'
import clsx from 'clsx'

const HQ_ROLES = ['HQ_CHIEF', 'HQ_MEMBER']  // 관리자는 채팅 참여하되 목록에 미노출
const HQ_ROLES_ALL = ['ADMIN', 'HQ_CHIEF', 'HQ_MEMBER']  // 접근 권한용

// 멤버별 고정 색상
const COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-rose-500'
]
function memberColor(uid: string, members: AppUser[]) {
  const idx = members.findIndex(m => m.uid === uid)
  return COLORS[idx % COLORS.length] ?? 'bg-gray-500'
}

export default function ChatPage() {
  const { user }  = useAuth()
  const router    = useRouter()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [members,  setMembers]  = useState<AppUser[]>([])
  const [text,     setText]     = useState('')
  const [sending,  setSending]  = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  const isHQ = user && HQ_ROLES_ALL.includes(user.role)

  useEffect(() => {
    if (!isHQ) { router.replace('/dashboard'); return }
    const u1 = listenChatMessages(user!.role, setMessages)
    // 멤버 목록에는 관리자 제외 (본부장·본부멤버만 표시)
    const u2 = listenUsers(all => setMembers(all.filter(u => HQ_ROLES.includes(u.role))))
    return () => { u1(); u2() }
  }, [isHQ, router])

  // 새 메시지 오면 스크롤 아래로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return
    setSending(true)
    await sendChatMessage(user.uid, user.name, user.role, text.trim())
    setText('')
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 날짜 구분선 표시 여부
  const getDateLabel = (msg: ChatMessage, prev?: ChatMessage) => {
    if (!msg.createdAt) return null
    const d = (msg.createdAt as any)?.toDate?.() ?? new Date(msg.createdAt as string)
    const pd = prev?.createdAt
      ? ((prev.createdAt as any)?.toDate?.() ?? new Date(prev.createdAt as string))
      : null
    const fmt = (dt: Date) => dt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    if (!pd || fmt(d) !== fmt(pd)) return fmt(d)
    return null
  }

  const formatTime = (ts: unknown) => {
    if (!ts) return ''
    const d = (ts as any)?.toDate?.() ?? new Date(ts as string)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  // 연속 메시지 여부 (같은 사람, 1분 이내)
  const isContinuous = (msg: ChatMessage, prev?: ChatMessage) => {
    if (!prev || prev.authorUid !== msg.authorUid) return false
    if (!msg.createdAt || !prev.createdAt) return false
    const t1 = (msg.createdAt as any)?.toDate?.() ?? new Date(msg.createdAt as string)
    const t2 = (prev.createdAt as any)?.toDate?.() ?? new Date(prev.createdAt as string)
    return Math.abs(t1.getTime() - t2.getTime()) < 60_000
  }

  return (
    <AppShell title="운영본부 채팅">
      <div className="max-w-4xl mx-auto px-4 pt-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-400">
          <span>🗑</span>
          <span>채팅 내용은 <strong className="text-gray-500">4주 후</strong> 자동 삭제됩니다</span>
        </div>
      </div>
      <div className="flex flex-col h-full">

        {/* 상단 바 */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {members.slice(0, 4).map(m => (
                <div key={m.uid}
                  className={clsx('w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white', memberColor(m.uid, members))}>
                  {m.name?.[0]}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500 font-medium">{members.length}명 참여중</span>
          </div>
          <button onClick={() => setShowMembers(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Users size={14}/> 멤버
          </button>
        </div>

        {/* 멤버 목록 드롭다운 */}
        {showMembers && (
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 shrink-0">
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <div key={m.uid} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                  <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0', memberColor(m.uid, members))}>
                    {m.name?.[0]}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{m.name}</span>
                  <span className="text-xs text-gray-400">
                    {m.role === 'ADMIN' ? '관리자' : m.role === 'HQ_CHIEF' ? '본부장' : '본부멤버'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center">
                <Users size={28} className="text-primary-400"/>
              </div>
              <p className="text-sm">운영본부 단체채팅입니다</p>
              <p className="text-xs">첫 번째 메시지를 보내보세요!</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const prev       = messages[i - 1]
            const isMe       = msg.authorUid === user?.uid
            const continuous = isContinuous(msg, prev)
            const dateLabel  = getDateLabel(msg, prev)
            const color      = memberColor(msg.authorUid, members)

            return (
              <div key={msg.id}>
                {/* 날짜 구분선 */}
                {dateLabel && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200"/>
                    <span className="text-xs text-gray-400 shrink-0">{dateLabel}</span>
                    <div className="flex-1 h-px bg-gray-200"/>
                  </div>
                )}

                <div className={clsx('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row', continuous ? 'mt-0.5' : 'mt-3')}>
                  {/* 아바타 */}
                  {!isMe && (
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5',
                      color,
                      continuous && 'invisible'
                    )}>
                      {msg.authorName?.[0]}
                    </div>
                  )}

                  <div className={clsx('max-w-[72%] flex flex-col', isMe ? 'items-end' : 'items-start')}>
                    {/* 이름 (첫 메시지에만) */}
                    {!isMe && !continuous && (
                      <span className="text-xs font-semibold text-gray-600 mb-1 ml-1">{msg.authorName}</span>
                    )}

                    <div className="flex items-end gap-1.5">
                      {/* 시간 (내 메시지는 왼쪽) */}
                      {isMe && (
                        <span className="text-xs text-gray-400 mb-0.5 shrink-0">{formatTime(msg.createdAt)}</span>
                      )}

                      {/* 말풍선 */}
                      <div className={clsx(
                        'px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words max-w-full',
                        isMe
                          ? 'bg-primary-600 text-white rounded-tr-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                      )}>
                        {msg.body}
                      </div>

                      {/* 시간 (상대방은 오른쪽) */}
                      {!isMe && (
                        <span className="text-xs text-gray-400 mb-0.5 shrink-0">{formatTime(msg.createdAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* 내 메시지 우측 여백 */}
                  {isMe && <div className="w-8 shrink-0"/>}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef}/>
        </div>

        {/* 입력창 */}
        <div className="bg-white border-t border-gray-200 px-3 py-3 shrink-0">
          <div className="flex items-end gap-2 bg-gray-100 rounded-2xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
              rows={1}
              style={{ resize: 'none', minHeight: '24px', maxHeight: '120px' }}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            <button onClick={handleSend}
              disabled={!text.trim() || sending}
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors mb-0.5',
                text.trim()
                  ? 'bg-primary-600 text-white hover:bg-primary-800'
                  : 'bg-gray-300 text-gray-400'
              )}>
              <Send size={15}/>
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-1.5">운영본부 멤버만 볼 수 있습니다</p>
        </div>
      </div>
    </AppShell>
  )
}
