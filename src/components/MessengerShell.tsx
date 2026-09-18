'use client'
import { ReactNode, useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import {
  listenBusinesses, listenUsers, listenDirectChatRooms,
  listenMessagesForHQ, listenMessagesForBiz,
  listenNotices, listenEvents, listenApprovalDocs,
  listenDirectChatMessages, sendDirectChat, markDirectChatRead,
  deleteDirectChatRoom
} from '@/lib/db'
import type { DirectChatRoom, DirectChatMessage } from '@/lib/db'
import type { AppUser, Business } from '@/types'
import type { Message, Notice, CalendarEvent, ApprovalDoc } from '@/types'
import {
  ChevronDown, ChevronRight, LogOut, Settings, Users,
  MessageSquare, Send, Bell, Calendar, Search,
  Megaphone, Building2, Lock, Menu, X, Trash2,
  ClipboardList
} from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '관리자', HQ_CHIEF: '본부장', HQ_MEMBER: '본부멤버',
  BIZ_REP: '사업장대표', ETC: '기타'
}

function getRoomId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

function formatTime(ts: unknown): string {
  if (!ts) return ''
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatDateDivider(ts: unknown): string {
  if (!ts) return ''
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

interface Props { children?: ReactNode; title?: string; hideSidebar?: boolean }

export default function MessengerShell({ children, title, hideSidebar }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // 데이터
  const [businesses,  setBusinesses]  = useState<Business[]>([])
  const [allUsers,    setAllUsers]    = useState<AppUser[]>([])
  const [chatRooms,   setChatRooms]   = useState<DirectChatRoom[]>([])
  const [messages,    setMessages]    = useState<DirectChatMessage[]>([])

  // 배지
  const [unreadMsg,    setUnreadMsg]    = useState(0)
  const [unreadDirect, setUnreadDirect] = useState(0)
  const [unreadNotice, setUnreadNotice] = useState(0)
  const [unreadCal,    setUnreadCal]    = useState(0)
  const [unreadApproval, setUnreadApproval] = useState(0)

  // UI 상태
  const [openHQ,       setOpenHQ]       = useState(true)   // 운영본부 열림
  const [openBiz,      setOpenBiz]      = useState(true)   // 사업장 열림
  const [openBizIds,   setOpenBizIds]   = useState<Set<string>>(new Set())  // 개별 사업장 열림
  const [mobileOpen,   setMobileOpen]   = useState(false)  // 모바일 사이드바
  const [activeUser,   setActiveUser]   = useState<AppUser | null>(null)
  const [activeRoom,   setActiveRoom]   = useState<string | null>(null)
  const [chatInput,    setChatInput]    = useState('')
  const [sending,      setSending]      = useState(false)
  const [rightTab,     setRightTab]     = useState<'chat'|'feed'>('chat') // 채팅 | 전달사항

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const isAdmin = user?.role === 'ADMIN'
  const isHQ    = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)
  const isBiz   = user?.role === 'BIZ_REP'
  const canBroadcast = isAdmin || user?.role === 'HQ_CHIEF' || !!user?.permissions?.canBroadcast

  // 데이터 구독
  useEffect(() => {
    if (loading || !user) return
    const u1 = listenBusinesses(setBusinesses)
    const u2 = listenUsers(setAllUsers)
    const u3 = listenDirectChatRooms(user.uid, rooms => {
      setChatRooms(rooms)
      const total = rooms.reduce((s, r) => s + (r.unread?.[user.uid] ?? 0), 0)
      setUnreadDirect(total)
    })
    return () => { u1(); u2(); u3() }
  }, [user, loading])

  // 메시지 배지
  useEffect(() => {
    if (!user) return
    if (isHQ) {
      return listenMessagesForHQ(user.uid, isAdmin, msgs => {
        const pending = msgs.filter(m =>
          m.type === 'broadcast' && m.status === 'open'
        ).length
        setUnreadMsg(pending)
      })
    }
    if (isBiz && user.bizId) {
      return listenMessagesForBiz(user.bizId, user.uid, msgs => {
        const pending = msgs.filter(m =>
          m.type === 'broadcast' &&
          m.receipts?.some(r => r.bizId === user.bizId && r.status === 'pending')
        ).length
        setUnreadMsg(pending)
      })
    }
  }, [user, isHQ, isAdmin, isBiz])

  // 채팅 메시지 구독
  useEffect(() => {
    if (!activeRoom) { setMessages([]); return }
    return listenDirectChatMessages(activeRoom, setMessages)
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

  const openChat = (target: AppUser) => {
    if (!user) return
    setActiveUser(target)
    setActiveRoom(getRoomId(user.uid, target.uid))
    setRightTab('chat')
    setMobileOpen(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSend = async () => {
    if (!user || !activeUser || !chatInput.trim() || sending) return
    setSending(true)
    const text = chatInput.trim()
    setChatInput('')
    await sendDirectChat(user.uid, user.name, activeUser.uid, activeUser.name, text)
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
      body: JSON.stringify({ title: `💬 ${user.name}`, body: text, url: '/', targetUids: [activeUser.uid] }),
    }).catch(() => {})
    setSending(false)
  }

  const handleDeleteRoom = async () => {
    if (!activeRoom || !confirm('대화를 삭제하시겠습니까?')) return
    await deleteDirectChatRoom(activeRoom)
    setActiveRoom(null)
    setActiveUser(null)
    setMessages([])
  }

  // 사이드바 트리 데이터
  const hqMembers    = allUsers.filter(u => ['HQ_CHIEF','HQ_MEMBER'].includes(u.role))
  const normalBizs   = businesses.filter(b => !b.isHQ)
  const bizMembersOf = (bizId: string) => allUsers.filter(u => u.bizId === bizId && u.role === 'BIZ_REP')

  // 사용자 채팅방 마지막 메시지
  const getLastMsg = (targetUid: string) => {
    if (!user) return null
    const roomId = getRoomId(user.uid, targetUid)
    return chatRooms.find(r => r.id === roomId) ?? null
  }

  const getUnread = (targetUid: string) => {
    if (!user) return 0
    const roomId = getRoomId(user.uid, targetUid)
    const room = chatRooms.find(r => r.id === roomId)
    return room?.unread?.[user.uid] ?? 0
  }

  const totalBadge = unreadMsg + unreadDirect + unreadNotice

  // ── 사이드바 ──────────────────────────────────────────
  const Sidebar = () => (
    <div className="flex flex-col h-full bg-[#1a1f2e] text-white select-none">
      {/* 상단 프로필 */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">
            {user?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-white/50">{ROLE_LABEL[user?.role ?? '']}</p>
          </div>
          <button onClick={() => signOut(auth).then(() => router.replace('/login'))}
            className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10">
            <LogOut size={15}/>
          </button>
        </div>
      </div>

      {/* 트리 목록 */}
      <div className="flex-1 overflow-y-auto py-2">

        {/* 운영본부 */}
        <div>
          <button onClick={() => setOpenHQ(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors text-white/70 hover:text-white">
            {openHQ ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            <Building2 size={14} className="text-primary-400"/>
            <span className="text-xs font-semibold tracking-wide flex-1 text-left">운영본부</span>
            <span className="text-xs text-white/30">{hqMembers.length}명</span>
          </button>
          {openHQ && (
            <div className="pl-6">
              {hqMembers.map(u => {
                const unread = getUnread(u.uid)
                const isActive = activeUser?.uid === u.uid
                return (
                  <button key={u.uid} onClick={() => openChat(u)}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mx-1 transition-colors text-left',
                      isActive ? 'bg-primary-600 text-white' : 'hover:bg-white/5 text-white/70 hover:text-white'
                    )}>
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold">
                        {u.name[0]}
                      </div>
                      {unread > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                          {unread > 9 ? '9+' : unread}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{u.name}</p>
                      <p className="text-[10px] text-white/40 truncate">
                        {getLastMsg(u.uid)?.lastMessage ?? ROLE_LABEL[u.role]}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 사업장 */}
        <div className="mt-1">
          <button onClick={() => setOpenBiz(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors text-white/70 hover:text-white">
            {openBiz ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            <Users size={14} className="text-amber-400"/>
            <span className="text-xs font-semibold tracking-wide flex-1 text-left">사업장</span>
            <span className="text-xs text-white/30">{normalBizs.length}개</span>
          </button>
          {openBiz && (
            <div className="pl-4">
              {normalBizs.map(biz => {
                const isOpen = openBizIds.has(biz.id)
                const members = bizMembersOf(biz.id)
                const bizUnread = members.reduce((s, u) => s + getUnread(u.uid), 0)
                return (
                  <div key={biz.id}>
                    <button
                      onClick={() => setOpenBizIds(prev => {
                        const next = new Set(prev)
                        next.has(biz.id) ? next.delete(biz.id) : next.add(biz.id)
                        return next
                      })}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg mx-1 transition-colors text-white/60 hover:text-white">
                      {isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                      <span className="text-xs flex-1 text-left truncate">{biz.name}</span>
                      {bizUnread > 0 && (
                        <span className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {bizUnread > 9 ? '9+' : bizUnread}
                        </span>
                      )}
                    </button>
                    {isOpen && (
                      <div className="pl-5">
                        {members.length === 0 ? (
                          <p className="text-[10px] text-white/30 px-3 py-1">멤버 없음</p>
                        ) : members.map(u => {
                          const unread = getUnread(u.uid)
                          const isActive = activeUser?.uid === u.uid
                          return (
                            <button key={u.uid} onClick={() => openChat(u)}
                              className={clsx(
                                'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg mx-1 transition-colors text-left',
                                isActive ? 'bg-primary-600 text-white' : 'hover:bg-white/5 text-white/60 hover:text-white'
                              )}>
                              <div className="relative shrink-0">
                                <div className="w-6 h-6 rounded-full bg-amber-800 flex items-center justify-center text-[10px] font-bold">
                                  {u.name[0]}
                                </div>
                                {unread > 0 && (
                                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                                    {unread}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium truncate">{u.name}</p>
                                <p className="text-[9px] text-white/40 truncate">
                                  {getLastMsg(u.uid)?.lastMessage ?? '사업장대표'}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 하단 메뉴 */}
      <div className="border-t border-white/10 px-2 py-2">
        <div className="grid grid-cols-5 gap-1">
          {[
            { icon: Send,        label: '전달', href: '/businesses', badge: unreadMsg,    show: true },
            { icon: Megaphone,   label: '공지', href: '/notices',   badge: unreadNotice, show: true },
            { icon: Calendar,    label: '일정', href: '/calendar',  badge: unreadCal,    show: true },
            { icon: Search,      label: '검색', href: '/search',    badge: 0,            show: true },
            { icon: Settings,    label: '설정', href: '/settings',  badge: 0,            show: true },
          ].filter(m => m.show).map(m => (
            <button key={m.href} onClick={() => router.push(m.href)}
              className={clsx(
                'flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-colors relative',
                pathname === m.href ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
              )}>
              <m.icon size={16}/>
              <span className="text-[9px]">{m.label}</span>
              {m.badge > 0 && (
                <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                  {m.badge > 9 ? '9+' : m.badge}
                </div>
              )}
            </button>
          ))}
        </div>
        {/* 관리자 전용 메뉴 */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-1 mt-1">
            <button onClick={() => router.push('/admin')}
              className="flex items-center justify-center gap-1 py-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Users size={13}/>
              <span className="text-[9px]">멤버관리</span>
            </button>
            <button onClick={() => router.push('/approval')}
              className="flex items-center justify-center gap-1 py-1.5 text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-colors">
              <Lock size={13}/>
              <span className="text-[9px]">전자결재</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ── 오른쪽 채팅 패널 ──────────────────────────────────
  const ChatPanel = () => {
    if (!activeUser) return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
          <MessageSquare size={28} className="text-gray-400"/>
        </div>
        <div className="text-center">
          <p className="text-gray-600 font-medium">대화 상대를 선택하세요</p>
          <p className="text-sm text-gray-400 mt-1">왼쪽 목록에서 멤버를 클릭하세요</p>
        </div>
      </div>
    )

    return (
      <div className="flex-1 flex flex-col">
        {/* 채팅 헤더 */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-1 text-gray-400">
            <Menu size={20}/>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700 shrink-0">
            {activeUser.name[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{activeUser.name}</p>
            <p className="text-xs text-gray-400">{ROLE_LABEL[activeUser.role]}</p>
          </div>
          {/* 탭 */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setRightTab('chat')}
              className={clsx('px-3 py-1.5 text-xs font-medium transition-colors',
                rightTab === 'chat' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50')}>
              💬 채팅
            </button>
            <button onClick={() => setRightTab('feed')}
              className={clsx('px-3 py-1.5 text-xs font-medium transition-colors',
                rightTab === 'feed' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50')}>
              📋 전달사항
            </button>
          </div>
          <button onClick={handleDeleteRoom} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={15}/>
          </button>
        </div>

        {rightTab === 'chat' ? (
          <>
            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                  <MessageSquare size={32} className="opacity-20"/>
                  <p className="text-sm">첫 메시지를 보내보세요</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMine = msg.senderUid === user?.uid
                const prevMsg = idx > 0 ? messages[idx-1] : null
                const showDate = idx === 0 || (() => {
                  const prev = (prevMsg?.createdAt as {toDate?:()=>Date})?.toDate?.()
                  const cur  = (msg.createdAt  as {toDate?:()=>Date})?.toDate?.()
                  return prev && cur && prev.toDateString() !== cur.toDateString()
                })()

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200"/>
                        <span className="text-xs text-gray-400">{formatDateDivider(msg.createdAt)}</span>
                        <div className="flex-1 h-px bg-gray-200"/>
                      </div>
                    )}
                    <div className={clsx('flex items-end gap-2 mb-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
                      {!isMine && (
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0 mb-0.5">
                          {msg.senderName[0]}
                        </div>
                      )}
                      <div className={clsx('flex flex-col max-w-[70%]', isMine ? 'items-end' : 'items-start')}>
                        <div className={clsx(
                          'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                          isMine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                        )}>
                          {msg.body}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 mx-1">{formatTime(msg.createdAt)}</span>
                      </div>
                      {isMine && <div className="w-7 shrink-0"/>}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef}/>
            </div>
            {/* 입력창 */}
            <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2">
                <input ref={inputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="메시지 입력..."
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"/>
                <button onClick={handleSend} disabled={!chatInput.trim() || sending}
                  className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-800 disabled:opacity-40 transition-colors shrink-0">
                  <Send size={14}/>
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 text-center">Enter로 전송</p>
            </div>
          </>
        ) : (
          // 전달사항 탭 — 해당 사업장의 전달사항 표시
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
              <Send size={32} className="opacity-20"/>
              <p className="text-sm">이 사용자와의 전달사항이 여기 표시됩니다</p>
              {canBroadcast && (
                <button onClick={() => router.push('/compose')}
                  className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm hover:bg-primary-800">
                  전달사항 작성
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
    </div>
  )

  // hideSidebar: 전자결재 같은 페이지에서 기존 AppShell 사용
  if (hideSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)}/>
      )}

      {/* 왼쪽 사이드바 */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 md:relative md:translate-x-0 md:z-auto',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar/>
      </div>

      {/* 오른쪽 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* children이 있으면 일반 페이지 (공지, 캘린더 등) */}
        {children ? (
          <div className="flex-1 overflow-y-auto">
            {/* 모바일 상단바 */}
            <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
              <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-500">
                <Menu size={20}/>
              </button>
              <h1 className="font-semibold text-gray-900 text-sm flex-1">{title}</h1>
              {totalBadge > 0 && (
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {totalBadge > 9 ? '9+' : totalBadge}
                </div>
              )}
            </div>
            {children}
          </div>
        ) : (
          // 채팅 패널
          <ChatPanel/>
        )}
      </div>
    </div>
  )
}
