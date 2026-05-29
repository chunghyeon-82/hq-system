'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, listenMessages, updateBusiness } from '@/lib/db'
import type { Business, Message, Shareholder } from '@/types'
import {
  Building2, Send, ChevronRight, Edit2, Check, X,
  Plus, Trash2, Users, TrendingUp, Phone, MapPin, User, PieChart
} from 'lucide-react'
import clsx from 'clsx'

export default function BusinessDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const { user } = useAuth()

  const [business, setBusiness] = useState<Business | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [filter,   setFilter]   = useState<'all' | 'open' | 'done'>('all')
  const [editing,  setEditing]  = useState(false)

  // 수정 폼 상태
  const [fName,     setFName]     = useState('')
  const [fAddress,  setFAddress]  = useState('')
  const [fRepName,  setFRepName]  = useState('')
  const [fPhone,    setFPhone]    = useState('')
  const [fTotalShares,    setFTotalShares]    = useState('')
  const [fShareholders,   setFShareholders]   = useState<Shareholder[]>([])
  const [fEmployeeCount,  setFEmployeeCount]  = useState('')
  const [fAnnualRevenue,  setFAnnualRevenue]  = useState('')
  const [saving, setSaving] = useState(false)

  const isHQ    = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isAdmin = user?.role === 'ADMIN'
  const canEditBiz = isAdmin || user?.role === 'HQ_CHIEF' || !!user?.permissions?.canEditBusiness

  useEffect(() => {
    const u1 = listenBusinesses(bizs => {
      const found = bizs.find(b => b.id === id) ?? null
      setBusiness(found)
    })
    const u2 = listenMessages(msgs =>
      setMessages(msgs.filter(m => m.targetBizIds.includes(id)))
    )
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

  const addShareholder = () =>
    setFShareholders(prev => [...prev, { name: '', shares: 0 }])

  const updateShareholder = (i: number, field: keyof Shareholder, value: string) =>
    setFShareholders(prev => prev.map((s, idx) =>
      idx === i ? { ...s, [field]: field === 'shares' ? Number(value) : value } : s
    ))

  const removeShareholder = (i: number) =>
    setFShareholders(prev => prev.filter((_, idx) => idx !== i))

  const filtered   = messages.filter(m => filter === 'all' ? true : m.status === filter)
  const openCount  = messages.filter(m => m.status === 'open').length
  const doneCount  = messages.filter(m => m.status === 'done').length
  const pendCount  = messages.reduce((acc, m) => {
    const r = m.receipts?.find(r => r.bizId === id)
    return acc + (r?.status === 'pending' ? 1 : 0)
  }, 0)

  // 주주 지분율 계산
  const totalShares = business?.totalShares
    ?? (business?.shareholders?.reduce((a, s) => a + s.shares, 0) ?? 0)

  if (!business) return (
    <AppShell title="사업장 상세" back="/businesses">
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </AppShell>
  )

  return (
    <AppShell title={business.name} back="/businesses">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── 기본 정보 카드 ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <Building2 size={20} className="text-primary-600"/>
              </div>
              <h2 className="font-bold text-gray-900">{business.name}</h2>
            </div>
            {isAdmin && !editing && (
              <button onClick={openEdit}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 border border-gray-200 hover:border-primary-300 px-3 py-1.5 rounded-lg transition-colors">
                <Edit2 size={13}/> 정보 수정
              </button>
            )}
          </div>

          {!editing ? (
            /* 보기 모드 */
            <div className="p-5 space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow icon={<User size={14}/>}     label="대표자"  value={business.repName} />
                <InfoRow icon={<Phone size={14}/>}    label="연락처"  value={business.phone} />
                <InfoRow icon={<MapPin size={14}/>}   label="주소"    value={business.address}  span />
                <InfoRow icon={<Users size={14}/>}    label="직원수"  value={business.employeeCount != null ? `${business.employeeCount.toLocaleString()}명` : undefined} />
                <InfoRow icon={<TrendingUp size={14}/>} label="연매출" value={business.annualRevenue != null ? `${business.annualRevenue.toLocaleString()}만원` : undefined} />
              </div>

              {/* 주주 현황 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PieChart size={15} className="text-gray-400"/>
                  <span className="text-sm font-semibold text-gray-700">주주 현황</span>
                  {business.totalShares && (
                    <span className="text-xs text-gray-400 ml-1">발행주식 총 {business.totalShares.toLocaleString()}주</span>
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
                              <div className="h-full bg-primary-400 rounded-full transition-all"
                                style={{ width: `${ratio}%` }}/>
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

              {/* 전달 통계 */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                {[
                  { label: '진행중', value: openCount, color: 'text-amber-600' },
                  { label: '완결',   value: doneCount, color: 'text-green-600' },
                  { label: '미접수', value: pendCount, color: pendCount > 0 ? 'text-red-600' : 'text-gray-400' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* 수정 모드 */
            <div className="p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">기본 정보</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: '사업장명 *', value: fName,    onChange: setFName,    placeholder: '○○ 지점' },
                  { label: '대표자명',   value: fRepName, onChange: setFRepName, placeholder: '홍길동' },
                  { label: '연락처',     value: fPhone,   onChange: setFPhone,   placeholder: '010-0000-0000' },
                  { label: '직원수 (명)', value: fEmployeeCount, onChange: setFEmployeeCount, placeholder: '10', type: 'number' },
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
                  <input value={fAddress} onChange={e => setFAddress(e.target.value)}
                    placeholder="서울시 강남구..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                </div>
              </div>

              {/* 주주 현황 편집 */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">주주 현황</p>
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">발행 총 주식수</label>
                  <input type="number" value={fTotalShares} onChange={e => setFTotalShares(e.target.value)}
                    placeholder="10000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                </div>
                <div className="space-y-2">
                  {fShareholders.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={s.name} onChange={e => updateShareholder(i, 'name', e.target.value)}
                        placeholder="주주명"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                      <input type="number" value={s.shares || ''} onChange={e => updateShareholder(i, 'shares', e.target.value)}
                        placeholder="주식수"
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

              {/* 저장/취소 */}
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
        {isHQ && (
          <button onClick={() => router.push(`/compose?biz=${id}`)}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-primary-800 transition-colors">
            <Send size={15}/> 이 사업장에 전달 작성
          </button>
        )}

        {/* ── 전달 목록 ── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['all', 'open', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx(
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              )}>
              {f === 'all' ? `전체 ${messages.length}` : f === 'open' ? `진행중 ${openCount}` : `완결 ${doneCount}`}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl">
              전달 내역이 없습니다
            </div>
          )}
          {filtered.map(msg => {
            const myReceipt = msg.receipts?.find(r => r.bizId === id)
            const isDone    = msg.status === 'done'
            return (
              <button key={msg.id}
                onClick={() => router.push(`/messages/${msg.id}`)}
                className={clsx(
                  'w-full text-left border rounded-xl p-4 hover:shadow-sm transition-all group',
                  isDone ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-gray-200 hover:border-primary-200'
                )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                      <span className={isDone ? 'badge-done' : 'badge-open'}>
                        {isDone ? '완결' : '진행중'}
                      </span>
                      <span className={
                        myReceipt?.status === 'replied'  ? 'badge-replied' :
                        myReceipt?.status === 'received' ? 'badge-received' : 'badge-pending'
                      }>
                        {myReceipt?.status === 'replied'  ? '답변완료' :
                         myReceipt?.status === 'received' ? '접수확인' : '미접수'}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-gray-900 truncate">{msg.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{msg.authorName}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 shrink-0"/>
                </div>
              </button>
            )
          })}
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
