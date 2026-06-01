'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenNotices, addNotice, deleteNotice } from '@/lib/db'
import type { Notice, NoticePrefix } from '@/types'
import { Megaphone, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

export default function NoticesPage() {
  const { user }   = useAuth()
  const router     = useRouter()
  const [notices, setNotices]       = useState<Notice[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [expanded, setExpanded]     = useState<string | null>(null)

  // 작성 폼
  const [prefix,    setPrefix]    = useState<NoticePrefix>('본부')
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving,    setSaving]    = useState(false)

  const isHQ = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const canWrite = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' ||
                   (user?.role === 'HQ_MEMBER' && !!user?.permissions?.canBroadcast) ||
                   user?.role === 'BIZ_REP'

  // 사업장 대표는 [사업장] 말머리만
  const prefixes: NoticePrefix[] = user?.role === 'BIZ_REP' ? ['사업장'] : ['본부', '사업장']

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    return listenNotices(setNotices)
  }, [user, router])

  const handleSubmit = async () => {
    if (!user || !title.trim() || !body.trim() || !expiresAt) return
    setSaving(true)
    await addNotice({
      prefix,
      title:      title.trim(),
      body:       body.trim(),
      authorUid:  user.uid,
      authorName: user.name,
      expiresAt:  new Date(expiresAt).toISOString(),
    })
    setTitle(''); setBody(''); setExpiresAt('')
    setShowForm(false)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return
    await deleteNotice(id)
  }

  const prefixColor = (p: NoticePrefix) =>
    p === '본부' ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'

  return (
    <AppShell title="공지사항">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* 작성 버튼 */}
        {canWrite && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
            <Plus size={16}/> 공지사항 작성
          </button>
        )}

        {/* 작성 폼 */}
        {showForm && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">공지사항 작성</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={18}/></button>
            </div>
            {/* 말머리 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">말머리</label>
              <div className="flex gap-2">
                {prefixes.map(p => (
                  <button key={p} onClick={() => setPrefix(p)}
                    className={clsx('px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                      prefix === p ? 'bg-primary-50 border-primary-400 text-primary-700' : 'bg-white border-gray-200 text-gray-600')}>
                    [{p}]
                  </button>
                ))}
              </div>
            </div>
            {/* 제목 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">제목</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="공지 제목"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>
            {/* 내용 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">내용</label>
              <textarea value={body} onChange={e => setBody(e.target.value)}
                rows={5} placeholder="공지 내용"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            </div>
            {/* 게시 종료일 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                게시 종료일 <span className="text-red-500">*</span>
              </label>
              <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <p className="text-xs text-gray-400 mt-1">종료일 이후 자동으로 삭제됩니다</p>
            </div>
            <button onClick={handleSubmit}
              disabled={!title.trim() || !body.trim() || !expiresAt || saving}
              className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
              {saving ? '등록 중...' : '공지 등록'}
            </button>
          </div>
        )}

        {/* 공지 목록 */}
        {notices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Megaphone size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">등록된 공지사항이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map(n => {
              const isOpen = expanded === n.id
              const canDel = user?.role === 'ADMIN' || user?.uid === n.authorUid
              const expDate = new Date(n.expiresAt).toLocaleDateString('ko-KR')
              return (
                <div key={n.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <button className="w-full text-left px-5 py-4"
                    onClick={() => setExpanded(isOpen ? null : n.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', prefixColor(n.prefix))}>
                            [{n.prefix}]
                          </span>
                          <span className="text-xs text-gray-400">{n.authorName}</span>
                          <span className="text-xs text-gray-300">~{expDate}</span>
                        </div>
                        <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canDel && (
                          <button onClick={e => { e.stopPropagation(); handleDelete(n.id) }}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg">
                            <Trash2 size={14}/>
                          </button>
                        )}
                        {isOpen ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
