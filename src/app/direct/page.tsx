'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import {
  listenUsers, listenDirectChatRooms, listenDirectChatMessages,
  sendDirectChat, markDirectChatRead, deleteDirectChatRoom
} from '@/lib/db'
import type { DirectChatRoom, DirectChatMessage } from '@/lib/db'
import type { AppUser } from '@/types'
import { Send, X, MessageSquare, ChevronLeft, Trash2 } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '관리자', HQ_CHIEF: '본부장', HQ_MEMBER: '본부멤버', BIZ_REP: '사업장대표', ETC: '기타'
}

function getRoomId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

function formatTime(ts: unknown): string {
  if (!ts) return ''
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatDate(ts: unknown): string {
  if (!ts) return ''
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

export default function DirectPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [allUsers,   setAllUsers]   = useState<AppUser[]>([])
  const [rooms,      setRooms]      = useState<DirectChatRoom[]>([])
  const [messages,   setMessages]   = useState<DirectChatMessage[]>([])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)  // roomId
  const [activeUser, setActiveUser] = useState<AppUser | null>(null)
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [showUsers,  setShowUsers]  = useState(false)  // 새 채팅 상대 선택

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const isHQ  = user && ['ADMIN', 'HQ_CHIEF', 'HQ_MEMBER'].includes(user.role)
  const isBiz = user?.role === 'BIZ_REP'

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (!isHQ && !isBiz) { router.replace('/dashboard'); return }
    const u1 = listenUsers(setAllUsers)
    const u2 = listenDirectChatRooms(user.uid, setRooms)
    return () => { u1(); u2() }
  }, [user, loading, router, isHQ, isBiz])

  // 메시지 구독 (채팅방 선택 시)
  useEffect(() => {
    if (!activeRoom) { setMessages([]); return }
    const unsub = listenDirectChatMessages(activeRoom, setMessages)
    return unsub
  }, [activeRoom])

  // 읽음 처리
  useEffect(() => {
    if (!activeRoom || !user) return
    markDirectChatRead(activeRoom, user.uid)
  }, [activeRoom, messages.length, user])

  // 스크롤 하단
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openChat = (targetUser: AppUser) => {
    if (!user) return
    const roomId = getRoomId(user.uid, targetUser.uid)
    setActiveRoom(roomId)
    setActiveUser(targetUser)
    setShowUsers(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('채팅방을 삭제하시겠습니까? 대화 내용이 모두 삭제됩니다.')) return
    await deleteDirectChatRoom(roomId)
    setActiveRoom(null)
    setActiveUser(null)
    setMessages([])
  }

  const handleSend = async () => {
    if (!user || !activeUser || !input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    await sendDirectChat(user.uid, user.name, activeUser.uid, activeUser.name, text)
    // 푸시 알림
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
      body: JSON.stringify({
        title: `💬 ${user.name}`,
        body:  text,
        url:   '/direct',
        targetUids: [activeUser.uid],
      }),
    }).catch(() => {})
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // 채팅방에서 상대방 정보
  const getRoomPartner = (room: DirectChatRoom) => {
    if (!user) return null
    const partnerUid = room.participants.find(uid => uid !== user.uid)
    return partnerUid ? allUsers.find(u => u.uid === partnerUid) ?? null : null
  }

  // 날짜 구분선
  const shouldShowDate = (msgs: DirectChatMessage[], idx: number) => {
    if (idx === 0) return true
    const prev = (msgs[idx-1].createdAt as { toDate?: () => Date })?.toDate?.()
    const cur  = (msgs[idx].createdAt   as { toDate?: () => Date })?.toDate?.()
    if (!prev || !cur) return false
    return prev.toDateString() !== cur.toDateString()
  }

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unread?.[user?.uid ?? ''] ?? 0), 0)

  // 사용자 목록 (채팅 상대 선택용)
  const chatTargets = allUsers.filter(u => u.uid !== user?.uid)

  return (
    <AppShell title={`1:1 채팅${totalUnread > 0 ? ` (${totalUnread})` : ''}`} back="/dashboard">
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">

        {/* ── 왼쪽: 채팅방 목록 ── */}
        <div className={clsx(
          'flex flex-col border-r border-gray-200 bg-white',
          activeRoom ? 'hidden md:flex md:w-72' : 'flex w-full md:w-72'
        )}>
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">메시지</h3>
            <button onClick={() => setShowUsers(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-800">
              <MessageSquare size={12}/> 새 채팅
            </button>
          </div>

          {/* 새 채팅 상대 선택 */}
          {showUsers && (
            <div className="border-b border-gray-100 bg-gray-50 max-h-48 overflow-y-auto">
              <p className="px-4 py-2 text-xs text-gray-400 font-medium">대화 상대 선택</p>
              {chatTargets.map(u => (
                <button key={u.uid} onClick={() => openChat(u)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                    {u.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABEL[u.role] ?? u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 채팅방 목록 */}
          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                <MessageSquare size={24} className="opacity-30"/>
                <p className="text-xs">아직 대화가 없습니다</p>
                <p className="text-xs text-primary-500">새 채팅 버튼을 눌러 시작하세요</p>
              </div>
            ) : (
              rooms
                .sort((a, b) => {
                  const ta = (a.lastAt as { toMillis?: () => number })?.toMillis?.() ?? 0
                  const tb = (b.lastAt as { toMillis?: () => number })?.toMillis?.() ?? 0
                  return tb - ta
                })
                .map(room => {
                  const partner = getRoomPartner(room)
                  if (!partner) return null
                  const unread = room.unread?.[user?.uid ?? ''] ?? 0
                  const isActive = activeRoom === room.id
                  return (
                    <button key={room.id} onClick={() => openChat(partner)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left',
                        isActive ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''
                      )}>
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">
                          {partner.name[0]}
                        </div>
                        {unread > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                            {unread > 9 ? '9+' : unread}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{partner.name}</p>
                          <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                            {formatTime(room.lastAt)}
                          </span>
                        </div>
                        <p className={clsx('text-xs truncate', unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400')}>
                          {room.lastMessage ?? ''}
                        </p>
                      </div>
                    </button>
                  )
                })
            )}
          </div>
        </div>

        {/* ── 오른쪽: 채팅 내용 ── */}
        <div className={clsx(
          'flex flex-col flex-1 bg-gray-50',
          !activeRoom ? 'hidden md:flex' : 'flex'
        )}>
          {!activeRoom ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <MessageSquare size={40} className="opacity-20"/>
              <p className="text-sm">대화를 선택하거나 새 채팅을 시작하세요</p>
            </div>
          ) : (
            <>
              {/* 채팅 헤더 */}
              <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
                <button onClick={() => { setActiveRoom(null); setActiveUser(null) }}
                  className="md:hidden p-1 text-gray-400 hover:text-gray-600">
                  <ChevronLeft size={20}/>
                </button>
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                  {activeUser?.name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{activeUser?.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABEL[activeUser?.role ?? ''] ?? ''}</p>
                </div>
                <button onClick={() => activeRoom && handleDeleteRoom(activeRoom)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="채팅방 삭제">
                  <Trash2 size={16}/>
                </button>
              </div>

              {/* 메시지 목록 */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {messages.map((msg, idx) => {
                  const isMine = msg.senderUid === user?.uid
                  const showDate = shouldShowDate(messages, idx)
                  const prevMsg = idx > 0 ? messages[idx-1] : null
                  const showSender = !isMine && msg.senderUid !== prevMsg?.senderUid

                  return (
                    <div key={msg.id}>
                      {/* 날짜 구분선 */}
                      {showDate && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-gray-200"/>
                          <span className="text-xs text-gray-400 shrink-0">
                            {formatDate(msg.createdAt)}
                          </span>
                          <div className="flex-1 h-px bg-gray-200"/>
                        </div>
                      )}

                      {/* 말풍선 */}
                      <div className={clsx('flex items-end gap-2 mb-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
                        {/* 상대방 아바타 */}
                        {!isMine && (
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0 mb-0.5">
                            {msg.senderName[0]}
                          </div>
                        )}

                        <div className={clsx('flex flex-col max-w-[70%]', isMine ? 'items-end' : 'items-start')}>
                          {showSender && (
                            <p className="text-xs text-gray-500 mb-1 ml-1">{msg.senderName}</p>
                          )}
                          <div className={clsx(
                            'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                            isMine
                              ? 'bg-primary-600 text-white rounded-br-sm'
                              : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                          )}>
                            {msg.body}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1 mx-1">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>

                        {/* 내 메시지 오른쪽 공간 */}
                        {isMine && <div className="w-7 shrink-0"/>}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef}/>
              </div>

              {/* 입력창 */}
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지 입력..."
                    className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-800 disabled:opacity-40 transition-colors shrink-0">
                    <Send size={14}/>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                  Enter로 전송 · 본인과 상대방만 볼 수 있습니다
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
