'use client'
import { ReactNode, useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import {
  listenBusinesses, listenUsers,
  listenChatRooms, listenChatRoomMessages,
  getOrCreateDirectRoom, createGroupRoom,
  sendChatRoomMessage, markChatRoomRead,
  deleteChatRoom, leaveChatRoom, inviteToChatRoom,
  listenMessagesForHQ, listenMessagesForBiz,
  listenBroadcastComments, addBroadcastComment, deleteBroadcastComment, markBroadcastRead,
} from '@/lib/db'
import type { ChatRoom, ChatMessage, BroadcastComment } from '@/lib/db'
import type { AppUser, Business, Message } from '@/types'
import {
  ChevronDown, ChevronRight, LogOut, Users, Plus,
  MessageSquare, Send, Calendar, Search, X,
  Building2, Lock, Trash2, Settings,
  UserPlus, Hash, Check, Megaphone, Bell, Edit2,
} from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '관리자', HQ_CHIEF: '본부장', HQ_MEMBER: '본부멤버',
  BIZ_REP: '사업장대표', ETC: '기타'
}

function formatTime(ts: unknown): string {
  if (!ts) return ''
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
  if (!d || isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatDateDiv(ts: unknown): string {
  if (!ts) return ''
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

interface Props { children?: ReactNode; title?: string }

export default function MessengerShell({ children, title }: Props) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  const [businesses,  setBusinesses]  = useState<Business[]>([])
  const [allUsers,    setAllUsers]    = useState<AppUser[]>([])
  const [rooms,       setRooms]       = useState<ChatRoom[]>([])
  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [broadcasts,  setBroadcasts]  = useState<Message[]>([])
  const [comments,    setComments]    = useState<BroadcastComment[]>([])

  const [activeRoom,       setActiveRoom]       = useState<ChatRoom | null>(null)
  const [activeBroadcast,  setActiveBroadcast]  = useState<Message | null>(null)
  const [chatInput,        setChatInput]        = useState('')
  const [commentInput,     setCommentInput]     = useState('')
  const [sending,          setSending]          = useState(false)
  const [sendingComment,   setSendingComment]   = useState(false)
  const [unreadBroadcast,  setUnreadBroadcast]  = useState(0)

  // 왼쪽/모바일 탭
  const [leftTab,   setLeftTab]   = useState<'broadcast' | 'members' | 'rooms'>('members')
  const [openHQ,    setOpenHQ]    = useState(true)
  const [openBiz,   setOpenBiz]   = useState(true)
  const [openBizIds, setOpenBizIds] = useState<Set<string>>(new Set())

  // 모달
  const [showCreate,   setShowCreate]   = useState(false)
  const [createName,   setCreateName]   = useState('')
  const [selectedUids, setSelectedUids] = useState<string[]>([])
  const [creating,     setCreating]     = useState(false)
  const [showInvite,   setShowInvite]   = useState(false)
  const [inviteUids,   setInviteUids]   = useState<string[]>([])
  const [inviting,     setInviting]     = useState(false)

  // 모바일: 채팅창 열림 여부
  const [mobileChat, setMobileChat] = useState(false)

  // 안드로이드 뒤로가기 처리
  useEffect(() => {
    if (mobileChat) {
      window.history.pushState({ mobileChat: true }, '')
    }
    const handlePopState = (e: PopStateEvent) => {
      if (mobileChat) {
        setMobileChat(false)
        setActiveRoom(null)
        setActiveBroadcast(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [mobileChat])

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLInputElement>(null)

  const isAdmin      = user?.role === 'ADMIN'
  const isHQ         = user && ['ADMIN', 'HQ_CHIEF', 'HQ_MEMBER'].includes(user.role)
  const isBiz        = user?.role === 'BIZ_REP'
  const canBroadcast = isAdmin || user?.role === 'HQ_CHIEF' || !!user?.permissions?.canBroadcast
  const canComment   = canBroadcast || !!user?.permissions?.canComment
  const totalUnread  = rooms.reduce((s, r) => s + (r.unread?.[user?.uid ?? ''] ?? 0), 0)

  useEffect(() => {
    if (loading || !user) return
    const u1 = listenBusinesses(setBusinesses)
    const u2 = listenUsers(setAllUsers)
    const u3 = listenChatRooms(user.uid, rooms => {
      setRooms(rooms)
      // activeRoom을 최신 데이터로 동기화 (input focus 유지)
      setActiveRoom(prev => {
        if (!prev?.id) return prev
        const updated = rooms.find(r => r.id === prev.id)
        if (!updated) return prev
        // 내용이 실제로 바뀐 경우만 업데이트
        if (JSON.stringify(updated.members) === JSON.stringify(prev.members) &&
            updated.lastMessage === prev.lastMessage) return prev
        return updated
      })
    })
    return () => { u1(); u2(); u3() }
  }, [user, loading])

  useEffect(() => {
    if (!user) return
    if (isHQ || isAdmin) {
      return listenMessagesForHQ(user.uid, !!isAdmin, msgs => {
        const bs = msgs.filter(m => m.type === 'broadcast')
          .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
        setBroadcasts(bs)
        setUnreadBroadcast(bs.filter(m => !((m as any).readBy ?? []).includes(user.uid)).length)
      })
    }
    if (isBiz && user.bizId) {
      return listenMessagesForBiz(user.bizId, user.uid, msgs => {
        const bs = msgs.filter(m => m.type === 'broadcast')
          .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
        setBroadcasts(bs)
        setUnreadBroadcast(bs.filter(m => !((m as any).readBy ?? []).includes(user.uid)).length)
      })
    }
  }, [user, isHQ, isAdmin, isBiz])

  useEffect(() => {
    if (!activeRoom?.id) { setMessages([]); return }
    return listenChatRoomMessages(activeRoom.id, setMessages)
  }, [activeRoom?.id])

  useEffect(() => {
    if (!activeRoom?.id || !user) return
    markChatRoomRead(activeRoom.id, user.uid)
  }, [activeRoom?.id, messages.length, user])

  useEffect(() => {
    if (!activeBroadcast) { setComments([]); return }
    return listenBroadcastComments(activeBroadcast.id, setComments)
  }, [activeBroadcast?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, comments])

  const openDirectChat = (target: AppUser) => {
    if (!user) return
    const existing = rooms.find(r =>
      r.type === 'direct' &&
      r.members.some(m => m.uid === target.uid) &&
      r.members.some(m => m.uid === user.uid)
    )
    const room: ChatRoom = existing ?? {
      id: '',
      name: target.name,
      type: 'direct',
      members: [
        { uid: user.uid, name: user.name, role: user.role },
        { uid: target.uid, name: target.name, role: target.role },
      ],
      memberUids: [user.uid, target.uid],
      createdBy: user.uid,
    }
    setActiveRoom(room)
    setActiveBroadcast(null)
    setLeftTab('rooms')
    setMobileChat(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleCreateRoom = async () => {
    if (!user || selectedUids.length === 0) return
    setCreating(true)
    const members = [
      { uid: user.uid, name: user.name, role: user.role },
      ...allUsers.filter(u => selectedUids.includes(u.uid))
        .map(u => ({ uid: u.uid, name: u.name, role: u.role }))
    ]
    const name = createName.trim() || members.map(m => m.name).join(', ')
    let roomId: string
    if (selectedUids.length === 1) {
      const target = allUsers.find(u => u.uid === selectedUids[0])!
      roomId = await getOrCreateDirectRoom(user.uid, user.name, user.role, target.uid, target.name, target.role)
    } else {
      roomId = await createGroupRoom(user.uid, name, members)
    }
    const found = rooms.find(r => r.id === roomId)
    setActiveRoom(found ?? { id: roomId, name, type: selectedUids.length === 1 ? 'direct' : 'group', members, memberUids: members.map(m => m.uid), createdBy: user.uid })
    setActiveBroadcast(null)
    setShowCreate(false)
    setCreateName('')
    setSelectedUids([])
    setCreating(false)
    setMobileChat(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSend = async () => {
    if (!user || !activeRoom || sending) return
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    setSending(true)
    let roomId = activeRoom.id
    if (!roomId) {
      const target = activeRoom.members.find(m => m.uid !== user.uid)
      if (!target) { setSending(false); return }
      roomId = await getOrCreateDirectRoom(user.uid, user.name, user.role, target.uid, target.name, target.role)
      setActiveRoom(prev => prev ? { ...prev, id: roomId } : prev)
    }
    await sendChatRoomMessage(roomId, user.uid, user.name, text, activeRoom.members.map(m => m.uid))
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
      body: JSON.stringify({ title: `💬 ${user.name}`, body: text, url: '/', targetUids: activeRoom.members.filter(m => m.uid !== user.uid).map(m => m.uid) }),
    }).catch(() => {})
    setSending(false)
    inputRef.current?.focus()
  }

  const handleSendComment = async () => {
    if (!user || !activeBroadcast || !commentInput.trim() || sendingComment) return
    setSendingComment(true)
    await addBroadcastComment(activeBroadcast.id, user.uid, user.name, commentInput.trim())
    setCommentInput('')
    setSendingComment(false)
  }

  const handleInvite = async () => {
    if (!user || !activeRoom || inviteUids.length === 0) return
    setInviting(true)
    const toInvite = allUsers.filter(u => inviteUids.includes(u.uid))
      .map(u => ({ uid: u.uid, name: u.name, role: u.role }))

    if (activeRoom.type === 'direct') {
      // 1:1 채팅에서 초대 → 새 그룹방 생성 (기존 1:1 방은 유지)
      const allMembers = [
        ...activeRoom.members,
        ...toInvite.filter(m => !activeRoom.members.some(am => am.uid === m.uid))
      ]
      const name = allMembers.map(m => m.name).join(', ')
      const newRoomId = await createGroupRoom(user.uid, name, allMembers)
      // 새 그룹방으로 이동 (rooms 목록 업데이트 기다림)
      setTimeout(() => {
        setRooms(prev => {
          const found = prev.find(r => r.id === newRoomId)
          if (found) setActiveRoom(found)
          return prev
        })
      }, 500)
      setActiveRoom({
        id: newRoomId,
        name,
        type: 'group',
        members: allMembers,
        memberUids: allMembers.map(m => m.uid),
        createdBy: user.uid,
      })
    } else {
      // 그룹 채팅에 멤버 추가
      await inviteToChatRoom(activeRoom.id, toInvite)
    }
    setShowInvite(false)
    setInviteUids([])
    setInviting(false)
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  const handleLeaveRoom = async () => {
    if (!user || !activeRoom) return
    if (!confirm(activeRoom.type === 'direct' ? '대화를 삭제하시겠습니까?' : '채팅방에서 나가시겠습니까?')) return
    if (activeRoom.type === 'direct') await deleteChatRoom(activeRoom.id)
    else await leaveChatRoom(activeRoom.id, user.uid, activeRoom.members)
    setActiveRoom(null)
    setMessages([])
    setMobileChat(false)
  }

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.type === 'direct' && user) return room.members.find(m => m.uid !== user.uid)?.name ?? room.name
    return room.name
  }
  const getRoomInitial = (room: ChatRoom) => {
    if (room.type === 'direct' && user) return room.members.find(m => m.uid !== user.uid)?.name?.[0] ?? '?'
    return room.name?.[0] ?? '#'
  }
  const sortedRooms = [...rooms].sort((a, b) => {
    const ta = (a.lastAt as {toMillis?:()=>number})?.toMillis?.() ?? 0
    const tb = (b.lastAt as {toMillis?:()=>number})?.toMillis?.() ?? 0
    return tb - ta
  })
  const hqMembers  = allUsers.filter(u => ['HQ_CHIEF', 'HQ_MEMBER'].includes(u.role))
  const normalBizs = businesses.filter(b => !b.isHQ)
  const bizMembers = (bizId: string) => allUsers.filter(u => u.bizId === bizId && u.role === 'BIZ_REP')

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
    </div>
  )

  // ── 채팅창 공통 컴포넌트 ──
  const ChatView = () => (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        {/* 모바일: 뒤로가기 */}
        <button onClick={() => setMobileChat(false)} className="md:hidden p-1 text-gray-400">
          <ChevronRight size={20} className="rotate-180"/>
        </button>
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
          activeRoom!.type === 'group' ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700')}>
          {activeRoom!.type === 'group' ? <Hash size={16}/> : getRoomInitial(activeRoom!)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {activeRoom!.type === 'group'
              ? activeRoom!.members.map(m => m.name).join(', ')
              : getRoomDisplayName(activeRoom!)}
          </p>
          <p className="text-xs text-gray-400">
            {activeRoom!.type === 'group'
              ? `그룹채팅 ${activeRoom!.members.length}명`
              : ROLE_LABEL[activeRoom!.members.find(m => m.uid !== user?.uid)?.role ?? '']}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
          <UserPlus size={16}/>
        </button>
        <button onClick={handleLeaveRoom} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={15}/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-white">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <MessageSquare size={28} className="opacity-20"/>
            <p className="text-sm">첫 메시지를 보내보세요</p>
          </div>
        )}
        {messages.filter(msg => {
          const myMember = activeRoom!.members.find(m => m.uid === user?.uid)
          if (!myMember?.joinedAt) return true
          const joinedMs = typeof myMember.joinedAt === 'string'
            ? new Date(myMember.joinedAt).getTime()
            : (myMember.joinedAt as {toMillis?:()=>number})?.toMillis?.() ?? 0
          const msgMs = (msg.createdAt as {toDate?:()=>Date})?.toDate?.()?.getTime() ?? new Date(msg.createdAt as string).getTime()
          return msgMs >= joinedMs
        }).map((msg, idx, arr) => {
          const isMine = msg.senderUid === user?.uid
          const prev   = idx > 0 ? arr[idx-1] : null
          const showDate = idx === 0 || (() => {
            const pd = (prev?.createdAt as {toDate?:()=>Date})?.toDate?.()
            const cd = (msg.createdAt  as {toDate?:()=>Date})?.toDate?.()
            return pd && cd && pd.toDateString() !== cd.toDateString()
          })()
          const showName = !isMine && activeRoom!.type === 'group'
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200"/>
                  <span className="text-xs text-gray-400 shrink-0">{formatDateDiv(msg.createdAt)}</span>
                  <div className="flex-1 h-px bg-gray-200"/>
                </div>
              )}
              <div className={clsx('flex items-end gap-2 mb-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mb-0.5">
                    {msg.senderName[0]}
                  </div>
                )}
                <div className={clsx('flex flex-col max-w-[70%]', isMine ? 'items-end' : 'items-start')}>
                  {showName && <p className="text-xs font-semibold text-gray-700 mb-1 ml-1">{msg.senderName}</p>}
                  <div className={clsx('px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                    isMine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100')}>
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
    </>
  )

  // ── 전달사항 상세 ──
  const BroadcastView = () => (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => { setActiveBroadcast(null); setMobileChat(false) }}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight size={20} className="rotate-180"/>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{activeBroadcast!.title}</p>
          <p className="text-xs text-gray-400">{activeBroadcast!.authorName} · {formatTime(activeBroadcast!.createdAt)}</p>
        </div>
        {canBroadcast && activeBroadcast!.authorUid === user?.uid && (
          <button onClick={() => router.push(`/messages/${activeBroadcast!.id}`)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
            <Edit2 size={15}/>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{activeBroadcast!.body}</p>
          {(activeBroadcast as any).imageUrls?.length > 0 && (
            <div className="mt-4 space-y-3">
              {((activeBroadcast as any).imageUrls as string[]).map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="w-full rounded-xl border border-gray-100"/>
              ))}
            </div>
          )}
          {(activeBroadcast as any).attachedFiles?.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">첨부파일</p>
              {((activeBroadcast as any).attachedFiles as {name:string;url:string;size:number}[]).map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" download={f.name}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-primary-50 transition-colors">
                  <span>📎</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">{(f.size/1024).toFixed(0)}KB</p>
                  </div>
                  <span className="text-xs text-primary-600 font-medium shrink-0">다운로드</span>
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">댓글 {comments.length}개</p>
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
                {c.authorName[0]}
              </div>
              <div className="flex-1 bg-white rounded-xl px-3.5 py-2.5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-800">{c.authorName}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">{formatTime(c.createdAt)}</span>
                    {(isAdmin || c.authorUid === user?.uid) && (
                      <button onClick={() => deleteBroadcastComment(activeBroadcast!.id, c.id)}
                        className="p-0.5 text-gray-300 hover:text-red-400 rounded transition-colors">
                        <X size={11}/>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700">{c.body}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
      </div>
    </>
  )

  // ── 사이드바 내용 (PC/모바일 공통) ──
  const SidebarContent = () => (
    <>
      {/* 전달사항 탭 */}
      <button onClick={() => { setLeftTab('broadcast'); setActiveRoom(null); setActiveBroadcast(null) }}
        className={clsx('w-full flex items-center gap-2.5 px-4 py-2.5 border-b border-white/10 transition-colors shrink-0',
          leftTab === 'broadcast' ? 'bg-primary-600/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/5')}>
        <Megaphone size={15} className={leftTab === 'broadcast' ? 'text-primary-400' : ''}/>
        <span className="text-xs font-semibold flex-1 text-left">전달사항</span>
        {unreadBroadcast > 0 && (
          <div className="min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold px-1">
            {unreadBroadcast > 99 ? '99+' : unreadBroadcast}
          </div>
        )}
      </button>

      {/* 멤버/채팅 탭 */}
      <div className="flex border-b border-white/10 shrink-0">
        <button onClick={() => setLeftTab('members')}
          className={clsx('flex-1 py-2 text-xs font-medium transition-colors relative',
            leftTab === 'members' ? 'text-white' : 'text-white/40 hover:text-white/70')}>
          멤버
          {leftTab === 'members' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400"/>}
        </button>
        <button onClick={() => setLeftTab('rooms')}
          className={clsx('flex-1 py-2 text-xs font-medium transition-colors relative',
            leftTab === 'rooms' ? 'text-white' : 'text-white/40 hover:text-white/70')}>
          채팅
          {totalUnread > 0 && (
            <span className="ml-1 w-4 h-4 inline-flex items-center justify-center bg-red-500 rounded-full text-[9px] font-bold">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
          {leftTab === 'rooms' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400"/>}
        </button>
      </div>

      {/* 탭 내용 */}
      <div className="flex-1 overflow-y-auto">
        {leftTab === 'broadcast' && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-white/40 py-4">
            <Megaphone size={24} className="opacity-50"/>
            <p className="text-xs text-center px-4">오른쪽 화면에서<br/>전달사항을 확인하세요</p>
          </div>
        )}

        {leftTab === 'members' && (
          <div className="py-2">
            <button onClick={() => setOpenHQ(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 text-white/60 hover:text-white transition-colors">
              {openHQ ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
              <Building2 size={13} className="text-primary-400"/>
              <span className="text-xs font-medium flex-1 text-left">운영본부</span>
              <span className="text-[10px] text-white/30">{hqMembers.length}명</span>
            </button>
            {openHQ && hqMembers.map(u => (
              <button key={u.uid} onClick={() => openDirectChat(u)}
                className="w-full flex items-center gap-2 pl-8 pr-4 py-2 hover:bg-white/5 text-white/60 hover:text-white transition-colors text-left">
                <div className="w-6 h-6 rounded-full bg-primary-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {u.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{u.name}</p>
                  <p className="text-[9px] text-white/30">{ROLE_LABEL[u.role]}</p>
                </div>
                <MessageSquare size={11} className="text-white/20 shrink-0"/>
              </button>
            ))}
            <button onClick={() => setOpenBiz(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 text-white/60 hover:text-white transition-colors mt-1">
              {openBiz ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
              <Users size={13} className="text-amber-400"/>
              <span className="text-xs font-medium flex-1 text-left">사업장</span>
              <span className="text-[10px] text-white/30">{normalBizs.length}개</span>
            </button>
            {openBiz && normalBizs.map(biz => {
              const isOpen = openBizIds.has(biz.id)
              const mems = bizMembers(biz.id)
              return (
                <div key={biz.id}>
                  <button onClick={() => setOpenBizIds(prev => {
                    const next = new Set(prev)
                    next.has(biz.id) ? next.delete(biz.id) : next.add(biz.id)
                    return next
                  })} className="w-full flex items-center gap-2 pl-8 pr-4 py-1.5 hover:bg-white/5 text-white/50 hover:text-white transition-colors">
                    {isOpen ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
                    <span className="text-xs flex-1 text-left truncate">{biz.name}</span>
                    <span className="text-[9px] text-white/20">{mems.length}</span>
                  </button>
                  {isOpen && mems.map(u => (
                    <button key={u.uid} onClick={() => openDirectChat(u)}
                      className="w-full flex items-center gap-2 pl-12 pr-4 py-1.5 hover:bg-white/5 text-white/50 hover:text-white transition-colors text-left">
                      <div className="w-5 h-5 rounded-full bg-amber-800 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {u.name[0]}
                      </div>
                      <p className="text-[11px] flex-1 truncate">{u.name}</p>
                      <MessageSquare size={10} className="text-white/20 shrink-0"/>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {leftTab === 'rooms' && (
          <>
            <div className="px-3 pt-3 pb-1">
              <button onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded-xl text-xs font-medium transition-colors">
                <Plus size={13}/> 채팅방 만들기
              </button>
            </div>
            {sortedRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-white/30">
                <MessageSquare size={20} className="opacity-50"/>
                <p className="text-xs">채팅방이 없습니다</p>
              </div>
            ) : sortedRooms.map(room => {
              const unread = room.unread?.[user?.uid ?? ''] ?? 0
              const isActive = activeRoom?.id === room.id
              return (
                <button key={room.id} onClick={() => { setActiveRoom(room); setActiveBroadcast(null); setMobileChat(true) }}
                  className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left border-b border-white/5',
                    isActive ? 'bg-primary-600/30 border-l-2 border-primary-400' : 'hover:bg-white/5')}>
                  <div className="relative shrink-0">
                    <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold',
                      room.type === 'group' ? 'bg-amber-700' : 'bg-primary-700')}>
                      {room.type === 'group' ? <Hash size={14}/> : getRoomInitial(room)}
                    </div>
                    {unread > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold px-1">
                        {unread > 99 ? '99+' : unread}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-white truncate">{getRoomDisplayName(room)}</p>
                      <span className="text-[9px] text-white/50 shrink-0">{formatTime(room.lastAt)}</span>
                    </div>
                    <p className={clsx('text-[10px] truncate mt-0.5',
                      unread > 0 ? 'text-white font-medium' : 'text-white/50')}>
                      {room.lastMessage || (room.type === 'group' ? `${room.members.length}명` : '새 대화')}
                    </p>
                  </div>
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* 하단 메뉴 */}
      <div className="border-t border-white/10 px-2 py-2 shrink-0">
        <div className="grid grid-cols-4 gap-1">
          {[
            { icon: Calendar, label: '일정',    path: '/calendar' },
            { icon: Search,   label: '검색',    path: '/search' },
            { icon: Settings, label: '설정',    path: '/settings' },
            { icon: Users,    label: '멤버관리', path: '/admin', adminOnly: true },
          ].filter(m => !m.adminOnly || isAdmin).map(m => (
            <button key={m.path} onClick={() => router.push(m.path)}
              className={clsx('flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-colors',
                pathname === m.path ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5')}>
              <m.icon size={15}/>
              <span className="text-[9px]">{m.label}</span>
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => router.push('/approval')}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors">
              <Lock size={15}/>
              <span className="text-[9px]">결재</span>
            </button>
          )}
        </div>
      </div>
    </>
  )

  // ── 모달 ──
  const Modals = () => (
    <>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">채팅방 만들기</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4">
              <input value={createName} onChange={e => setCreateName(e.target.value)}
                placeholder="채팅방 이름 (선택, 1:1은 자동)"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                {allUsers.filter(u => u.uid !== user?.uid).map(u => (
                  <button key={u.uid}
                    onClick={() => setSelectedUids(prev => prev.includes(u.uid) ? prev.filter(id => id !== u.uid) : [...prev, u.uid])}
                    className={clsx('w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 transition-colors text-left',
                      selectedUids.includes(u.uid) ? 'bg-primary-50' : 'hover:bg-gray-50')}>
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                      {u.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p>
                    </div>
                    <div className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                      selectedUids.includes(u.uid) ? 'border-primary-600 bg-primary-600' : 'border-gray-300')}>
                      {selectedUids.includes(u.uid) && <Check size={11} className="text-white"/>}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={handleCreateRoom} disabled={selectedUids.length === 0 || creating}
                className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors">
                {creating ? '생성 중...' : selectedUids.length === 1 ? '1:1 채팅 시작' : '그룹 채팅방 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showInvite && activeRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">멤버 초대</h3>
                <p className="text-xs text-gray-400 mt-0.5">초대된 멤버는 초대 이후 메시지만 볼 수 있습니다</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="text-gray-400"><X size={18}/></button>
            </div>
            <div className="p-5">
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto mb-4">
                {allUsers.filter(u => u.uid !== user?.uid && !activeRoom.members.some(m => m.uid === u.uid)).map(u => (
                  <button key={u.uid}
                    onClick={() => setInviteUids(prev => prev.includes(u.uid) ? prev.filter(id => id !== u.uid) : [...prev, u.uid])}
                    className={clsx('w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 transition-colors text-left',
                      inviteUids.includes(u.uid) ? 'bg-primary-50' : 'hover:bg-gray-50')}>
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                      {u.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p>
                    </div>
                    <div className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                      inviteUids.includes(u.uid) ? 'border-primary-600 bg-primary-600' : 'border-gray-300')}>
                      {inviteUids.includes(u.uid) && <Check size={11} className="text-white"/>}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={handleInvite} disabled={inviteUids.length === 0 || inviting}
                className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors">
                {inviting ? '초대 중...' : `${inviteUids.length}명 초대하기`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // children이 있는 경우 (일정, 검색, 설정 등 서브페이지)
  if (children) {
    return (
      <div className="flex h-screen overflow-hidden">
        {/* PC: 사이드바 */}
        <div className="hidden md:flex w-64 flex-shrink-0 flex-col bg-[#1e2130] text-white">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">
              {user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-white/40">{ROLE_LABEL[user?.role ?? '']}</p>
            </div>
            <button onClick={() => signOut(auth).then(() => router.replace('/login'))}
              className="p-1.5 text-white/30 hover:text-white rounded-lg hover:bg-white/10 shrink-0">
              <LogOut size={14}/>
            </button>
          </div>
          <SidebarContent/>
        </div>
        {/* 콘텐츠 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 모바일 상단바 */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#1e2130] text-white shrink-0">
            <button onClick={() => router.back()} className="p-1">
              <ChevronRight size={20} className="rotate-180"/>
            </button>
            <h1 className="font-semibold text-sm flex-1">{title}</h1>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
          {/* 모바일 하단 탭바 */}
          <div className="md:hidden flex border-t border-gray-200 bg-white shrink-0">
            {[
              { icon: Megaphone, label: '전달', action: () => { router.push('/'); setLeftTab('broadcast') }, badge: unreadBroadcast },
              { icon: Users,     label: '멤버', action: () => { router.push('/'); setLeftTab('members') }, badge: 0 },
              { icon: MessageSquare, label: '채팅', action: () => { router.push('/'); setLeftTab('rooms') }, badge: totalUnread },
              { icon: Search,    label: '검색', action: () => router.push('/search'), badge: 0 },
              { icon: Settings,  label: '설정', action: () => router.push('/settings'), badge: 0 },
            ].map((m, i) => (
              <button key={i} onClick={m.action}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-gray-500 hover:text-primary-600 relative">
                <m.icon size={20}/>
                <span className="text-[10px]">{m.label}</span>
                {m.badge > 0 && (
                  <div className="absolute top-1.5 right-1/4 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                    {m.badge > 9 ? '9+' : m.badge}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── PC 레이아웃 ── */}
      <div className="hidden md:flex w-64 flex-shrink-0 flex-col bg-[#1e2130] text-white">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">
            {user?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-white/40">{ROLE_LABEL[user?.role ?? '']}</p>
          </div>
          <button onClick={() => signOut(auth).then(() => router.replace('/login'))}
            className="p-1.5 text-white/30 hover:text-white rounded-lg hover:bg-white/10 shrink-0">
            <LogOut size={14}/>
          </button>
        </div>
        <SidebarContent/>
      </div>

      {/* PC 오른쪽 */}
      <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-gray-50">
        {leftTab === 'broadcast' && !activeBroadcast ? (
          // 전달사항 게시판 목록
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">전달사항</h2>
                <p className="text-xs text-gray-400 mt-0.5">총 {broadcasts.length}건</p>
              </div>
              {canBroadcast && (
                <button onClick={() => router.push('/compose')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors">
                  <Plus size={14}/> 등록
                </button>
              )}
            </div>
            {/* 게시판 테이블 */}
            <div className="flex-1 overflow-y-auto">
              {broadcasts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
                  <Megaphone size={32} className="opacity-20"/>
                  <p className="text-sm">등록된 전달사항이 없습니다</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-center text-xs font-medium text-gray-500 py-3 px-4 w-12">번호</th>
                      <th className="text-left text-xs font-medium text-gray-500 py-3 px-4">제목</th>
                      <th className="text-center text-xs font-medium text-gray-500 py-3 px-4 w-24">작성자</th>
                      <th className="text-center text-xs font-medium text-gray-500 py-3 px-4 w-24">일자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {broadcasts.map((msg, idx) => (
                      <tr key={msg.id}
                        onClick={() => {
                        setActiveBroadcast(msg)
                        setMobileChat(true)
                        if (user && !((msg as any).readBy ?? []).includes(user.uid)) {
                          markBroadcastRead(msg.id, user.uid)
                        }
                      }}
                        className="hover:bg-primary-50 cursor-pointer transition-colors">
                        <td className="text-center text-sm text-gray-400 py-3 px-4">
                          {broadcasts.length - idx}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {!((msg as any).readBy ?? []).includes(user?.uid ?? '') && (
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0"/>
                            )}
                            <span className="text-sm font-medium text-gray-800 hover:text-primary-600">
                              {msg.title}
                            </span>
                            {comments && (
                              <span className="text-xs text-gray-400 ml-1"></span>
                            )}
                          </div>
                        </td>
                        <td className="text-center text-sm text-gray-500 py-3 px-4">{msg.authorName}</td>
                        <td className="text-center text-xs text-gray-400 py-3 px-4">{formatTime(msg.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : activeBroadcast ? (
          <>
            <BroadcastView/>
            {canComment ? (
              <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
                <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2">
                  <input ref={commentRef} value={commentInput} onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                    placeholder="댓글 입력..."
                    autoComplete="off"
                    className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"/>
                  <button onClick={handleSendComment} disabled={!commentInput.trim() || sendingComment}
                    className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-800 disabled:opacity-40 transition-colors shrink-0">
                    <Send size={14}/>
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0 text-center">
                <p className="text-xs text-gray-400">댓글 권한이 없습니다</p>
              </div>
            )}
          </>
        ) : activeRoom ? (
          <>
            <ChatView/>
            <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2">
                <input
                  ref={inputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="메시지 입력..."
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"/>
                <button onClick={handleSend} disabled={!chatInput.trim() || sending}
                  className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-800 disabled:opacity-40 transition-colors shrink-0">
                  <Send size={14}/>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <MessageSquare size={28} className="text-gray-400"/>
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-medium">안녕하세요, {user?.name}님!</p>
              <p className="text-sm text-gray-400 mt-1">왼쪽에서 대화 상대를 선택하세요</p>
            </div>
            {unreadBroadcast > 0 && (
              <button onClick={() => setLeftTab('broadcast')}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-100 transition-colors">
                <Bell size={15}/> 읽지 않은 전달사항 {unreadBroadcast}건
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 모바일 레이아웃 (카톡 방식) ── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {/* 채팅창 열린 경우 */}
        {mobileChat && (activeRoom || activeBroadcast) ? (
          <div className="flex flex-col h-full bg-white">
            {activeBroadcast ? (
              <>
                <BroadcastView/>
                {canComment ? (
                  <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2">
                      <input ref={commentRef} value={commentInput} onChange={e => setCommentInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                        placeholder="댓글 입력..."
                        autoComplete="off"
                        className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"/>
                      <button onClick={handleSendComment} disabled={!commentInput.trim() || sendingComment}
                        className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-800 disabled:opacity-40 transition-colors shrink-0">
                        <Send size={14}/>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0 text-center">
                    <p className="text-xs text-gray-400">댓글 권한이 없습니다</p>
                  </div>
                )}
              </>
            ) : activeRoom ? (
              <>
                <ChatView/>
                <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2">
                    <input
                      ref={inputRef}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder="메시지 입력..."
                      autoComplete="off"
                      className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"/>
                    <button onClick={handleSend} disabled={!chatInput.trim() || sending}
                      className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-800 disabled:opacity-40 transition-colors shrink-0">
                      <Send size={14}/>
                    </button>
                  </div>
                </div>
              </>
            ) : <BroadcastView/>}
          </div>
        ) : leftTab === 'broadcast' ? (
          // 모바일 전달사항 게시판
          <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">전달사항</h2>
                <p className="text-xs text-gray-400">총 {broadcasts.length}건</p>
              </div>
              {canBroadcast && (
                <button onClick={() => router.push('/compose')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium">
                  <Plus size={12}/> 등록
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {broadcasts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
                  <Megaphone size={32} className="opacity-20"/>
                  <p className="text-sm">등록된 전달사항이 없습니다</p>
                </div>
              ) : broadcasts.map((msg, idx) => (
                <button key={msg.id}
                  onClick={() => {
                        setActiveBroadcast(msg)
                        setMobileChat(true)
                        if (user && !((msg as any).readBy ?? []).includes(user.uid)) {
                          markBroadcastRead(msg.id, user.uid)
                        }
                      }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                  <span className="text-xs text-gray-400 w-6 shrink-0">{broadcasts.length - idx}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {!((msg as any).readBy ?? []).includes(user?.uid ?? '') && <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0"/>}
                      <p className="text-sm font-medium text-gray-800 truncate">{msg.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{msg.authorName}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // 목록 화면
          <div className="flex flex-col h-full bg-[#1e2130]">
            {/* 모바일 상단 프로필 */}
            <div className="px-4 py-3 flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold shrink-0">
                {user?.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/40">{ROLE_LABEL[user?.role ?? '']}</p>
              </div>
              <button onClick={() => signOut(auth).then(() => router.replace('/login'))}
                className="p-1.5 text-white/30 hover:text-white rounded-lg">
                <LogOut size={14}/>
              </button>
            </div>
            <SidebarContent/>
          </div>
        )}

        {/* 모바일 하단 탭바 */}
        {!mobileChat && (
          <div className="flex border-t border-white/10 bg-[#1e2130] shrink-0">
            {[
              { icon: Megaphone,      label: '전달', tab: 'broadcast' as const, badge: unreadBroadcast },
              { icon: Users,          label: '멤버', tab: 'members'   as const, badge: 0 },
              { icon: MessageSquare,  label: '채팅', tab: 'rooms'     as const, badge: totalUnread },
              { icon: Search,         label: '검색', tab: null,                 badge: 0 },
              { icon: Settings,       label: '설정', tab: null,                 badge: 0 },
            ].map((m, i) => (
              <button key={i}
                onClick={() => {
                  if (m.tab) setLeftTab(m.tab)
                  else if (m.label === '검색') router.push('/search')
                  else if (m.label === '설정') router.push('/settings')
                }}
                className={clsx('flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-colors',
                  (m.tab && leftTab === m.tab) ? 'text-white' : 'text-white/40 hover:text-white')}>
                <m.icon size={20}/>
                <span className="text-[10px]">{m.label}</span>
                {m.badge > 0 && (
                  <div className="absolute top-1.5 right-1/4 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                    {m.badge > 9 ? '9+' : m.badge}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Modals/>
    </div>
  )
}
