'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, listenMessages, updateBusiness } from '@/lib/db'
import type { Business, Message, Shareholder } from '@/types'
import {
  Building2, Send, ChevronRight, Edit2, Check, X,
  Plus, Trash2, Users, TrendingUp, Phone, MapPin, User, PieChart,
  AlertCircle, Clock, CheckCircle2
} from 'lucide-react'
import clsx from 'clsx'

type CardFilter = 'all' | 'pending' | 'open' | 'done'

export default function BusinessDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()

  const [business, setBusiness] = useState<Business | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [filter,   setFilter]   = useState<CardFilter>('all')
  const [editing,  setEditing]  = useState(false)

  const [fName,          setFName]          = useState('')
  const [fAddress,       setFAddress]       = useState('')
  const [fRepName,       setFRepName]       = useState('')
  const [fPhone,         setFPhone]         = useState('')
  const [fTotalShares,   setFTotalShares]   = useState('')
  const [fShareholders,  setFShareholders]  = useState<Shareholder[]>([])
  const [fEmployeeCount, setFEmployeeCount] = useState('')
  const [fAnnualRevenue, setFAnnualRevenue] = useState('')
  const [saving,         setSaving]         = useState(false)

  const isAdmin    = user?.role === 'ADMIN'
  const isHQChief  = user?.role === 'HQ_CHIEF'
  const canEditBiz = isAdmin || isHQChief || !!user?.permissions?.canEditBusiness

  useEffect(() => {
    const u1 = listenBusinesses(bizs => setBusiness(bizs.find(b => b.id === id) ?? null))
    const u2 = listenMessages(msgs => setMessages(msgs.filter(m =>
      m.type === 'broadcast' && m.targetBizIds.includes(id)
    )))
    return () => { u1(); u2() }
  }, [id])

  const openEdit = () => {
    if (!business) return
    setFName(business.name ?? '')
    setFAddress(business.address ?? '')
    setFRepName(business.repName ?? '')
    setFPhone(business.phone ?? '')
    setFTotalShares(business.totalShares?.toString() ?? '')
    setFShareholders(business.shareholders ? [...business.shareholders] : [])
    setFEmployeeCount(business.employeeCount?.toString() ?? '')
    setFAnnualRevenue(business.annualRevenue?.toString() ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    if (!business || !fName.trim()) return
    setSaving(true)
    await updateBusiness(business.id, {
      name:          fName.trim(),
      address:       fAddress.trim(),
      repName:       fRepName.trim(),
      phone:         fPhone.trim(),
      totalShares:   fTotalShares   ? Number(fTotalShares)   : undefined,
      shareholders:  fShareholders.filter(s => s.name.trim()),
      employeeCount: fEmployeeCount ? Number(fEmployeeCount) : undefined,
      annualRevenue: fAnnualRevenue ? Number(fAnnualRevenue) : undefined,
    })
    setSaving(false)
    setEditing(false)
  }

  const addShareholder    = () => setFShareholders(p => [...p, { name: '', shares: 0 }])
  const updateShareholder = (i: number, field: keyof Shareholder, value: string) =>
    setFShareholders(p => p.map((s, idx) =>
      idx === i ? { ...s, [field]: field === 'shares' ? Number(value) : value } : s
    ))
  const removeShareholder = (i: number) => setFShareholders(p => p.filter((_, idx) => idx !== i))

  // ── 통계 계산 ──────────────────────────────────────────
  const pendingMsgs = messages.filter(m => {
    const r = m.receipts?.find(r => r.bizId === id)
    return r?.status === 'pending'
  })
  const openMsgs  = messages.filter(m => m.status === 'open' && !pendingMsgs.includes(m))
  const doneMsgs  = messages.filter(m => m.status === 'done')

  // 필터별 표시 목록
  const filtered = filter === 'all'     ? messages
    : filter === 'pending' ? pendingMsgs
    : filter === 'open'    ? openMsgs
    :                        doneMsgs

  const totalShares = business?.totalShares
    ?? (business?.shareholders?.reduce((a, s) => a + s.shares, 0) ?? 0)

  if (!business) return (
    <AppShell title="사업장 상세" back="/businesses">
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </AppShell>
  )

  // 통계 카드 정의 (순서: 미접수 → 진행중 → 완결)
  const statCards = [
    {
      key:       'pending' as CardFilter,
      label:     '미접수',
      value:     pendingMsgs.length,
      icon:      AlertCircle,
      color:     pendingMsgs.length > 0 ? 'text-red-600'   : 'text-gray-400',
      bg:        pendingMsgs.length > 0 ? 'bg-red-50'      : 'bg-gray-50',
      ring:      'ring-red-300',
    },
    {
      key:       'open' as CardFilter,
      label:     '진행중',
      value:     openMsgs.length,
      icon:      Clock,
      color:     'text-amber-600',
      bg:        'bg-amber-50',
      ring:      'ring-amber-300',
    },
    {
      key:       'done' as CardFilter,
      label:     '완결',
      value:     doneMsgs.length,
      icon:      CheckCircle2,
      color:     'text-green-600',
      bg:        'bg-green-50',
      ring:      'ring-green-300',
    },
  ]

  return (
    <AppShell title={business.name} back="/businesses">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── 사업장 정보 카드 ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <Building2 size={20} className="text-primary-600"/>
              </div>
              <h2 className="font-bold text-gray-900">{business.name}</h2>
            </div>
            {canEditBiz && !editing && (
              <button onClick={openEdit}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 border border-gray-200 hover:border-primary-300 px-3 py-1.5 rounded-lg transition-colors">
                <Edit2 size={13}/> 정보 수정
              </button>
            )}
          </div>

          {!editing ? (
            <div className="p-5 space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow icon={<User size={14}/>}       label="대표자" value={business.repName} />
                <InfoRow icon={<Phone size={14}/>}      label="연락처" value={business.phone} />
                <InfoRow icon={<MapPin size={14}/>}     label="주소"   value={business.address} span />
                <InfoRow icon={<Users size={14}/>}      label="직원수" value={business.employeeCount != null ? `${business.employeeCount.toLocaleString()}명` : undefined} />
                <InfoRow icon={<TrendingUp size={14}/>} label="연매출" value={business.annualRevenue != null ? `${business.annualRevenue.toLocaleString()}만원` : undefined} />
              </div>

              {/* 주주 현황 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PieChart size={15} className="text-gray-400"/>
                  <span className="text-sm font-semibold text-gray-700">주주 현황</span>
                  {business.totalShares && (
                    <span className="text-xs text-gray-400">발행 총 {business.totalShares.toLocaleString()}주</span>
                  )}
                </div>
                {business.shareholders && business.shareholders.length > 0 ? (
                  <div className="space-y-2">
                    {business.shareholders.map((s, i) => {
                      const ratio = totalShares > 0 ? (s.shares / totalShares) * 100 : 0
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                            {s.name?.[0] ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-medium text-gray-800">{s.name}</span>
                              <span className="text-xs text-gray-500">{s.shares.toLocaleString()}주 ({ratio.toFixed(1)}%)</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${ratio}%` }}/>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">등록된 주주 정보가 없습니다</p>
                )}
              </div>

              {/* ── 통계 카드 (미접수/진행중/완결) — 클릭하면 필터 ── */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                {statCards.map(card => (
                  <button key={card.key}
                    onClick={() => setFilter(f => f === card.key ? 'all' : card.key)}
                    className={clsx(
                      'flex flex-col items-center py-3 rounded-xl border transition-all active:scale-95',
                      card.bg,
                      filter === card.key ? `ring-2 ${card.ring} border-transparent` : 'border-transparent hover:border-gray-200'
                    )}>
                    <card.icon size={16} className={clsx('mb-1', card.color)}/>
                    <p className={clsx('text-xl font-bold', card.color)}>{card.value}</p>
                    <p className="text-xs text-gray-600">{card.label}</p>
                    {filter === card.key && (
                      <span className="text-xs text-gray-400 mt-0.5">▲ 필터중</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 수정 모드 */
            <div className="p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">기본 정보</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: '사업장명 *',    value: fName,          onChange: setFName,          placeholder: '○○ 지점' },
                  { label: '대표자명',      value: fRepName,       onChange: setFRepName,       placeholder: '홍길동' },
                  { label: '연락처',        value: fPhone,         onChange: setFPhone,         placeholder: '010-0000-0000' },
                  { label: '직원수 (명)',   value: fEmployeeCount, onChange: setFEmployeeCount, placeholder: '10', type: 'number' },
                  { label: '연매출 (만원)', value: fAnnualRevenue, onChange: setFAnnualRevenue, placeholder: '50000', type: 'number' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input type={f.type ?? 'text'} value={f.value} onChange={e => f.onChange(e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                  <input value={fAddress} onChange={e => setFAddress(e.target.value)} placeholder="서울시 강남구..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                </div>
              </div>
              <div className="pt-2">
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">발행 총 주식수</label>
                  <input type="number" value={fTotalShares} onChange={e => setFTotalShares(e.target.value)} placeholder="10000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                </div>
                <div className="space-y-2">
                  {fShareholders.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={s.name} onChange={e => updateShareholder(i, 'name', e.target.value)} placeholder="주주명"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                      <input type="number" value={s.shares || ''} onChange={e => updateShareholder(i, 'shares', e.target.value)} placeholder="주식수"
                        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                      <button onClick={() => removeShareholder(i)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addShareholder}
                  className="mt-2 flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium">
                  <Plus size={14}/> 주주 추가
                </button>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={handleSave} disabled={saving || !fName.trim()}
                  className="flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors">
                  <Check size={14}/> {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  <X size={14}/> 취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 전달 작성 버튼 ── */}
        <button onClick={() => router.push(`/compose?biz=${id}`)}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-primary-800 transition-colors">
          <Send size={15}/> 이 사업장에 전달 작성
        </button>

        {/* ── 메시지 목록 (필터 탭 제거, 카드가 필터 역할) ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">
              {filter === 'all'     ? `전체 메시지 ${messages.length}건` :
               filter === 'pending' ? `미접수 ${pendingMsgs.length}건` :
               filter === 'open'    ? `진행중 ${openMsgs.length}건` :
                                      `완결 ${doneMsgs.length}건`}
            </h3>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="text-xs text-primary-600 hover:underline">전체 보기</button>
            )}
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl">
                {filter === 'pending' ? '미접수 메시지가 없습니다 👍' :
                 filter === 'open'    ? '진행중인 메시지가 없습니다' :
                 filter === 'done'    ? '완결된 메시지가 없습니다' :
                                        '전달 내역이 없습니다'}
              </div>
            )}
            {filtered.map(msg => {
              const myReceipt  = msg.receipts?.find(r => r.bizId === id)
              const isDone     = msg.status === 'done'
              const isPending  = myReceipt?.status === 'pending'
              const isReceived = myReceipt?.status === 'received'
              const isReplied  = myReceipt?.status === 'replied'

              return (
                <button key={msg.id}
                  onClick={() => router.push(`/messages/${msg.id}`)}
                  className={clsx(
                    'w-full text-left border rounded-xl p-4 hover:shadow-sm transition-all group',
                    isDone ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-200 hover:border-primary-200'
                  )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 뱃지 */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                        {isDone    && <span className="badge-done">완결</span>}
                        {!isDone && isPending  && <span className="badge-pending">미접수</span>}
                        {!isDone && isReceived && <span className="badge-received">진행중</span>}
                        {!isDone && isReplied  && <span className="badge-replied">답변완료</span>}
                      </div>

                      {/* 제목 */}
                      <p className="font-medium text-sm text-gray-900 truncate">{msg.title}</p>

                      {/* 발신자 + 접수시간 */}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">{msg.authorName}</span>
                        {myReceipt?.receivedAt && (
                          <span className="text-xs text-blue-500">
                            접수 {new Date(myReceipt.receivedAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
                          </span>
                        )}
                        {myReceipt?.repliedAt && (
                          <span className="text-xs text-green-500">
                            답변 {new Date(myReceipt.repliedAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 shrink-0 mt-1"/>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function InfoRow({ icon, label, value, span }: {
  icon: React.ReactNode; label: string; value?: string; span?: boolean
}) {
  return (
    <div className={clsx('flex flex-col gap-0.5', span && 'col-span-2')}>
      <span className="text-xs text-gray-400 flex items-center gap-1">{icon}{label}</span>
      <span className={clsx('text-sm', value ? 'text-gray-900 font-medium' : 'text-gray-300 italic')}>
        {value ?? '미입력'}
      </span>
    </div>
  )
}
