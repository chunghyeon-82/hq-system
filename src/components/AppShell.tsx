'use client'
// src/components/AppShell.tsx
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, listenMessages } from '@/lib/db'
import type { Business, Message } from '@/types'
import {
  LayoutDashboard, Send, Settings,
  LogOut, Building2, Menu, X, Bell, ShieldCheck,
} from 'lucide-react'
import clsx from 'clsx'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [messages,   setMessages]   = useState<Message[]>([])
  const [sideOpen,   setSideOpen]   = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const unsub1 = listenBusinesses(setBusinesses)
    const unsub2 = listenMessages(
      user.role === 'BIZ_REP' ? (user.bizId ?? null) : null,
      setMessages
    )
    return () => { unsub1(); unsub2() }
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isAdmin  = user.role === 'ADMIN'
  const isHQ     = user.role === 'HQ_CHIEF' || user.role === 'HQ_MEMBER'
  const canSend  = isAdmin || isHQ  // 관리자, 본부장, 본부멤버 전달 작성 가능

  const pendingByBiz = (bizId: string) =>
    messages.filter(m =>
      m.targetBizIds.includes(bizId) &&
      (m.receipts.find(r => r.bizId === bizId)?.status === 'pending')
    ).length

  const totalPending = (isHQ || isAdmin)
    ? messages.reduce((acc, m) => acc + m.receipts.filter(r => r.status === 'pending').length, 0)
    : 0

  const roleLabel = () => {
    if (user.role === 'ADMIN')      return '관리자'
    if (user.role === 'HQ_CHIEF')   return '본부장'
    if (user.role === 'HQ_MEMBER')  return '본부멤버'
    return '사업장대표'
  }

  const navItems = [
    { href: '/dashboard',  label: '대시보드',      Icon: LayoutDashboard },
    { href: '/businesses', label: '사업장 목록',   Icon: Building2 },
    ...(canSend  ? [{ href: '/compose', label: '전달/지시 작성', Icon: Send }] : []),
    ...(isAdmin  ? [{ href: '/admin',   label: '멤버 관리',      Icon: Settings }] : []),
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-900 truncate">본부 관리 시스템</span>
      </div>

      {/* 내 정보 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="text-sm font-medium text-gray-900">{user.name}</div>
          {isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{roleLabel()}</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-2 py-1.5">메뉴</div>
        {navItems.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setSideOpen(false)}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
              pathname === href
                ? 'bg-primary-50 text-primary-800 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {href === '/dashboard' && totalPending > 0 && (
              <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">{totalPending}</span>
            )}
          </Link>
        ))}

        {/* 사업장 목록 (본부/관리자) */}
        {(isHQ || isAdmin) && businesses.length > 0 && (
          <>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-2 py-1.5 mt-3">사업장</div>
            {businesses.map(b => {
              const cnt = pendingByBiz(b.id)
              return (
                <Link
                  key={b.id}
                  href={`/businesses/${b.id}`}
                  onClick={() => setSideOpen(false)}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
                    pathname === `/businesses/${b.id}`
                      ? 'bg-primary-50 text-primary-800 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <div className="w-5 h-5 rounded-md bg-primary-100 flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-primary-800">
                    {b.name[0]}
                  </div>
                  <span className="flex-1 truncate">{b.name}</span>
                  {cnt > 0 && (
                    <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">{cnt}</span>
                  )}
                </Link>
              )
            })}
          </>
        )}

        {/* 사업장대표: 내 사업장 */}
        {user.role === 'BIZ_REP' && user.bizId && (
          <>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-2 py-1.5 mt-3">내 사업장</div>
            <Link
              href={`/businesses/${user.bizId}`}
              onClick={() => setSideOpen(false)}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                pathname === `/businesses/${user.bizId}`
                  ? 'bg-primary-50 text-primary-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{businesses.find(b => b.id === user.bizId)?.name ?? '내 사업장'}</span>
              {pendingByBiz(user.bizId) > 0 && (
                <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">
                  {pendingByBiz(user.bizId)}
                </span>
              )}
            </Link>
          </>
        )}
      </nav>

      <div className="px-2 py-3 border-t border-gray-100">
        <button
          onClick={() => { signOut(); router.replace('/login') }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 flex-shrink-0">
        <SidebarContent />
      </aside>

      {sideOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSideOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-xl">
            <button onClick={() => setSideOpen(false)} className="absolute top-3 right-3 p-1 text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setSideOpen(true)} className="p-1 text-gray-600">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-gray-900">본부 관리 시스템</span>
          <div className="relative">
            <Bell className="w-5 h-5 text-gray-500" />
            {totalPending > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                {totalPending}
              </span>
            )}
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
