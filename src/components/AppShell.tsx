'use client'
import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { listenMessagesForHQ, listenMessagesForBiz } from '@/lib/db'
import type { Message } from '@/types'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { useSettings } from '@/lib/settings-context'
import {
  LayoutDashboard, Building2, Send, Users, LogOut, Menu, X,
  ChevronRight, MessageSquare, MessageCircle, Settings,
  Megaphone, Calendar, Search
} from 'lucide-react'
import clsx from 'clsx'

interface Props { children: ReactNode; title?: string; back?: string }

export default function AppShell({ children, title, back }: Props) {
  const { user }     = useAuth()
  const { settings } = useSettings()
  const router       = useRouter()
  const pathname     = usePathname()
  const [open,       setOpen]       = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadDirect, setUnreadDirect] = useState(0)

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

  const isAdmin      = user?.role === 'ADMIN'
  const isHQChief    = user?.role === 'HQ_CHIEF'
  const isHQMember   = user?.role === 'HQ_MEMBER'
  const isHQ         = isAdmin || isHQChief || isHQMember
  const canBroadcast = isAdmin || isHQChief || !!user?.permissions?.canBroadcast

  const fontClass = settings.fontSize === 'small' ? 'text-xs' : settings.fontSize === 'large' ? 'text-base' : 'text-sm'

  const nav = [
    { href: '/dashboard',  label: '대시보드',    icon: LayoutDashboard, show: true },
    { href: '/businesses', label: '사업장 현황',  icon: Building2,       show: isHQ },
    { href: '/compose',    label: '전달 작성',    icon: Send,            show: canBroadcast },
    { href: '/notices',    label: '공지사항',     icon: Megaphone,       show: true },
    { href: '/calendar',   label: '캘린더',       icon: Calendar,        show: true },
    { href: '/search',     label: '메시지 검색',  icon: Search,          show: true },
    { href: '/chat',       label: '운영본부 채팅', icon: MessageCircle,   show: isHQ },
    { href: '/direct',     label: '1:1 메시지',   icon: MessageSquare,   show: true },
    { href: '/admin',      label: '멤버 관리',    icon: Users,           show: isAdmin },
    { href: '/settings',   label: '설정',         icon: Settings,        show: true },
  ].filter(n => n.show)

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
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              (pathname === href || (pathname.startsWith(href) && href !== '/dashboard'))
                ? 'bg-primary-600 text-white'
                : 'text-primary-100 hover:bg-primary-800'
            )}>
            <Icon size={18}/>{label}
          </Link>
        ))}
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
