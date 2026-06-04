'use client'
import { useState, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AppShell from './AppShell'
import { useAuth } from '@/lib/auth-context'
import clsx from 'clsx'
import {
  FilePlus, FileInput, Clock, CheckCircle2, XCircle,
  Eye, FileText, Archive, Settings, Stamp, Bookmark,
  AlignLeft, Users, ChevronDown, ChevronRight
} from 'lucide-react'

interface MenuItem {
  label:    string
  path?:    string
  icon:     React.ElementType
  children?: { label: string; path: string }[]
}

const MENU: MenuItem[] = [
  {
    label: '결재 문서',
    icon: FileText,
    children: [
      { label: '공문 작성',  path: '/approval/new' },
      { label: '공문 접수',  path: '/approval/incoming/new' },
      { label: '내부 품의',  path: '/approval/internal/new' },
    ]
  },
  {
    label: '진행 상황',
    icon: Clock,
    children: [
      { label: '결재 대기',    path: '/approval/status/pending' },
      { label: '결재 진행상황',path: '/approval/status/progress' },
      { label: '완료 문서',    path: '/approval/status/done' },
      { label: '반려 문서',    path: '/approval/status/rejected' },
      { label: '공람 문서',    path: '/approval/status/viewer' },
    ]
  },
  {
    label: '공문 목록',
    icon: Archive,
    children: [
      { label: '발신 공문 목록', path: '/approval/docs/outgoing' },
      { label: '수신 공문 목록', path: '/approval/docs/incoming' },
      { label: '품의서 목록',    path: '/approval/docs/internal' },
      { label: '보관 공문',      path: '/approval/archive' },
    ]
  },
  {
    label: '전자결재 설정',
    icon: Settings,
    children: [
      { label: '도장 등록',          path: '/approval/settings/seal' },
      { label: '결재선 관리',        path: '/approval/settings/lines' },
      { label: '하단 발신 정보',     path: '/approval/settings/footer-info' },
      { label: '수신자 관리',        path: '/approval/settings/recipients' },
    ]
  },
]

interface Props {
  children: ReactNode
  title?:   string
}

export default function ApprovalShell({ children, title }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useAuth()

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    '결재 문서': true,
    '진행 상황': true,
    '공문 목록': true,
    '전자결재 설정': false,
  })

  const toggleSection = (label: string) =>
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }))

  const isActive = (path: string) => pathname === path

  return (
    <AppShell title={title ?? '전자결재'}>
      <div className="flex h-full">
        {/* 전자결재 전용 사이드바 */}
        <aside className="w-52 shrink-0 bg-white border-r border-gray-200 overflow-y-auto hidden md:flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileText size={15} className="text-primary-500"/> 전자결재
            </h2>
          </div>
          <nav className="flex-1 py-2">
            {MENU.map(item => (
              <div key={item.label}>
                {/* 섹션 헤더 */}
                <button
                  onClick={() => toggleSection(item.label)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 transition-colors">
                  <item.icon size={13}/>
                  <span className="flex-1 text-left">{item.label}</span>
                  {openSections[item.label]
                    ? <ChevronDown size={12}/>
                    : <ChevronRight size={12}/>}
                </button>
                {/* 서브메뉴 */}
                {openSections[item.label] && item.children && (
                  <div className="pb-1">
                    {item.children.map(child => (
                      <button key={child.path}
                        onClick={() => router.push(child.path)}
                        className={clsx(
                          'w-full text-left pl-8 pr-4 py-2 text-sm transition-colors',
                          isActive(child.path)
                            ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-500'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}>
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </AppShell>
  )
}
