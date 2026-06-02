'use client'
import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { listenMessagesForHQ, listenMessagesForBiz, listenNotices, listenChatMessages, listenEvents } from '@/lib/db'
import type { Message, Notice, CalendarEvent } from '@/types'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { useSettings } from '@/lib/settings-context'
import {
  LayoutDashboard, Building2, Send, Users, LogOut, Menu, X,
  ChevronRight, MessageSquare, MessageCircle, Settings,
  Megaphone, Calendar, Search, GripVertical
} from 'lucide-react'
import clsx from 'clsx'

interface Props { children: ReactNode; title?: string; back?: string }

export default function AppShell({ children, title, back }: Props) {
  const { user }     = useAuth()
  const { settings } = useSettings()
  const router       = useRouter()
  const pathname     = usePathname()
  const [open,        setOpen]        = useState(false)
  const [editMode,    setEditMode]    = useState(false)
  const [navOrder,    setNavOrder]    = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem('navOrder')
    return saved ? JSON.parse(saved) : []
  })
  const [dragIdx,     setDragIdx]     = useState<number | null>(null)
  const [dragOver,    setDragOver]    = useState<number | null>(null)
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [unreadDirect, setUnreadDirect] = useState(0)
  const [unreadChat,   setUnreadChat]   = useState(0)
  const [unreadNotice, setUnreadNotice] = useState(0)
  const [unreadCal,    setUnreadCal]    = useState(0)
  const [lastSeenChat, setLastSeenChat] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('lastSeenChat') || '') : ''
  )
  const [lastSeenNotice, setLastSeenNotice] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('lastSeenNotice') || '') : ''
  )
  const [lastSeenCal, setLastSeenCal] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('lastSeenCal') || '') : ''
  )

  const isAdmin      = user?.role === 'ADMIN'
  const isHQChief    = user?.role === 'HQ_CHIEF'
  const isHQMember   = user?.role === 'HQ_MEMBER'
  const isHQ         = isAdmin || isHQChief || isHQMember
  const isBiz        = user?.role === 'BIZ_REP'
  const canBroadcast = isAdmin || isHQChief || !!user?.permissions?.canBroadcast

  useEffect(() => {
    if (!user) return
    if (isHQ || isAdmin) {
      return listenMessagesForHQ(user.uid, isAdmin, (msgs: Message[]) => {
        const pending = msgs.filter(m =>
          m.type === 'broadcast' && m.status === 'open' &&
          m.receipts?.some(r => r.status === 'pending')
        ).length
        setUnreadCount(pending)
        const direct = msgs.filter(m =>
          m.type === 'direct' && m.status === 'open' &&
          (m.targetUid === user.uid || m.authorUid === user.uid)
        ).length
        setUnreadDirect(direct)
      })
    }
    if (isBiz && user.bizId) {
      return listenMessagesForBiz(user.bizId, user.uid, (msgs: Message[]) => {
        const pending = msgs.filter(m =>
          m.type === 'broadcast' &&
          m.receipts?.some(r => r.bizId === user.bizId && r.status === 'pending')
        ).length
        setUnreadCount(pending)
        const direct = msgs.filter(m =>
          m.type === 'direct' && m.status === 'open' &&
          (m.targetUid === user.uid || m.authorUid === user.uid)
        ).length
        setUnreadDirect(direct)
      })
    }
  }, [user, isHQ, isAdmin, isBiz])

  // Firestore Timestamp → ms 변환
  const toMs = (t: unknown): number => {
    if (!t) return 0
    if (typeof t === 'object' && t !== null && 'toMillis' in t) return (t as {toMillis:()=>number}).toMillis()
    if (typeof t === 'number') return t
    return 0
  }

  // 운영본부 채팅 미읽음
  useEffect(() => {
    if (!user || !isHQ) return
    return listenChatMessages(user.role, (msgs) => {
      const unseen = msgs.filter(m =>
        toMs(m.createdAt) > parseInt(lastSeenChat || '0') && m.authorUid !== user.uid
      ).length
      setUnreadChat(unseen)
    })
  }, [user, isHQ, lastSeenChat])

  // 공지사항 미읽음
  useEffect(() => {
    if (!user) return
    return listenNotices((notices: Notice[]) => {
      const unseen = notices.filter(n =>
        toMs(n.createdAt) > parseInt(lastSeenNotice || '0') && n.authorUid !== user.uid
      ).length
      setUnreadNotice(unseen)
    })
  }, [user, lastSeenNotice])

  // 캘린더 미읽음 (오늘 이후 일정 중 내가 등록 안 한 것)
  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    return listenEvents(user.uid, user.bizId, (events: CalendarEvent[]) => {
      const unseen = events.filter(e =>
        e.date >= today && toMs(e.createdAt) > parseInt(lastSeenCal || '0') && e.ownerUid !== user.uid
      ).length
      setUnreadCal(unseen)
    })
  }, [user, lastSeenCal])

  const fontClass = settings.fontSize === 'small' ? 'text-xs' : settings.fontSize === 'large' ? 'text-base' : 'text-sm'

  const nav = [
    { href: '/dashboard',  label: '대시보드',    icon: LayoutDashboard, show: true,          badge: 0,            group: '' },
    { href: '/businesses', label: '사업장 현황',  icon: Building2,       show: isHQ,          badge: unreadCount,  group: '업무' },
    { href: '/compose',    label: '전달 작성',    icon: Send,            show: canBroadcast,  badge: 0,            group: '업무' },
    { href: '/notices',    label: '공지사항',     icon: Megaphone,       show: true,          badge: unreadNotice, group: '업무' },
    { href: '/chat',       label: '운영본부 채팅', icon: MessageCircle,   show: isHQ,          badge: unreadChat,   group: '메시지' },
    { href: '/direct',     label: '1:1 메시지',   icon: MessageSquare,   show: true,          badge: unreadDirect, group: '메시지' },
    { href: '/search',     label: '메시지 검색',  icon: Search,          show: true,          badge: 0,            group: '메시지' },
    { href: '/calendar',   label: '캘린더',       icon: Calendar,        show: true,          badge: unreadCal,    group: '일정' },
    { href: '/admin',      label: '멤버 관리',    icon: Users,           show: isAdmin,       badge: 0,            group: '관리' },
    { href: '/settings',   label: '설정',         icon: Settings,        show: true,          badge: 0,            group: '관리' },
  ].filter(n => n.show)

  // 저장된 순서 적용
  const sortedNav = navOrder.length > 0
    ? [...nav].sort((a, b) => {
        const ai = navOrder.indexOf(a.href)
        const bi = navOrder.indexOf(b.href)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    : nav

  const handleDragStart = (i: number) => setDragIdx(i)
  const handleDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i) }
  const handleDrop      = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOver(null); return }
    const newNav = [...sortedNav]
    const [moved] = newNav.splice(dragIdx, 1)
    newNav.splice(i, 0, moved)
    const order = newNav.map(n => n.href)
    setNavOrder(order)
    localStorage.setItem('navOrder', JSON.stringify(order))
    setDragIdx(null); setDragOver(null)
  }

  const handleLogout = async () => { await signOut(auth); router.replace('/login') }
  const roleLabel: Record<string, string> = {
    ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타'
  }
  const displayRole = user?.role === 'ETC' && user?.customRole
    ? user.customRole : roleLabel[user?.role ?? '']

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-primary-900 text-white">
      {/* 로고 */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-primary-800 shrink-0">
        <Building2 size={22} className="text-primary-200"/>
        <span className="font-bold text-base">본부관리시스템</span>
        <button onClick={() => setOpen(false)} className="ml-auto lg:hidden text-primary-300 hover:text-white">
          <X size={18}/>
        </button>
      </div>
      {/* 네비게이션 */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {/* 편집 모드 버튼 */}
        <button onClick={() => setEditMode(v => !v)}
          className="w-full text-left px-3 py-1.5 mb-1 text-xs text-primary-400 hover:text-primary-200 flex items-center gap-1.5">
          <GripVertical size={12}/>
          {editMode ? '순서 변경 완료 ✓' : '메뉴 순서 변경'}
        </button>
        <div className="space-y-0.5">
          {sortedNav.map(({ href, label, icon: Icon, badge, group }, idx) => {
            const prevGroup = idx > 0 ? sortedNav[idx - 1].group : null
            const showGroup = !editMode && group && group !== prevGroup && group !== ''
            const isActive  = pathname === href || (pathname.startsWith(href) && href !== '/dashboard')
            return (
              <div key={href}>
                {showGroup && (
                  <div className="px-3 pt-4 pb-1">
                    <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">{group}</span>
                  </div>
                )}
                {editMode ? (
                  <div
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
                    onDrop={() => handleDrop(idx)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing',
                      dragOver === idx ? 'bg-primary-500' : 'bg-primary-800/50 text-primary-100'
                    )}>
                    <GripVertical size={16} className="text-primary-400 shrink-0"/>
                    <Icon size={18}/>
                    <span className="flex-1">{label}</span>
                  </div>
                ) : (
                  <Link href={href} onClick={() => {
                    setOpen(false)
                    const ms = Date.now().toString()
                    if (href === '/chat')    { localStorage.setItem('lastSeenChat',   ms); setLastSeenChat(ms);   setUnreadChat(0) }
                    if (href === '/notices') { localStorage.setItem('lastSeenNotice', ms); setLastSeenNotice(ms); setUnreadNotice(0) }
                    if (href === '/calendar'){ localStorage.setItem('lastSeenCal',    ms); setLastSeenCal(ms);    setUnreadCal(0) }
                    if (href === '/direct')  { setUnreadDirect(0) }
                  }}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive ? 'bg-primary-600 text-white' : 'text-primary-100 hover:bg-primary-800'
                    )}>
                    <Icon size={18}/>
                    <span className="flex-1">{label}</span>
                    {badge > 0 && (
                      <span className="bg-red-500 text-white font-bold rounded-full flex items-center justify-center"
                        style={{ fontSize:'11px', minWidth:'18px', height:'18px', padding:'0 4px' }}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </nav>
      {/* 유저 정보 */}
      <div className="p-4 border-t border-primary-800 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
            {user?.name?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-primary-300">{displayRole}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-primary-300 hover:text-white text-xs w-full px-2 py-1.5 rounded hover:bg-primary-800 transition-colors">
          <LogOut size={14}/> 로그아웃
        </button>
      </div>
    </aside>
  )

  return (
    <div className={clsx('flex h-screen bg-gray-50 overflow-hidden', fontClass)}>

      {/* ── PC: 사이드바 항상 고정 (lg 이상) ── */}
      <div className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col">
        <Sidebar/>
      </div>

      {/* ── 모바일: 드로어 오버레이 ── */}
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-60 flex flex-col shadow-2xl">
            <Sidebar/>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)}/>
        </div>
      )}

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 헤더 */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
          {/* 모바일 햄버거 */}
          <button onClick={() => setOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu size={22}/>
          </button>
          {back && (
            <button onClick={() => router.push(back)} className="text-gray-500 hover:text-gray-700">
              <ChevronRight size={20} className="rotate-180"/>
            </button>
          )}
          {title && <h1 className="font-semibold text-gray-900 text-base">{title}</h1>}
        </header>
        {/* 페이지 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
