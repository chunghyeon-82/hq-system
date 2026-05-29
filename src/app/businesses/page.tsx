'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, listenMessages, addBusiness, updateBusiness, deleteBusiness } from '@/lib/db'
import type { Business, Message } from '@/types'
import { Plus, Building2, Phone, MapPin, Edit2, Trash2, Send, ChevronRight, Clock, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

export default function BusinessesPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [messages,   setMessages]   = useState<Message[]>([])
  const [showForm,   setShowForm]   = useState(false)
  const [editBiz,    setEditBiz]    = useState<Business | null>(null)

  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    const u1 = listenBusinesses(setBusinesses)
    const u2 = listenMessages(setMessages)
    return () => { u1(); u2() }
  }, [])

  // 사업장별 메시지 요약
  const getBizStats = (bizId: string) => {
    const bizMsgs = messages.filter(m => m.targetBizIds.includes(bizId))
    const open    = bizMsgs.filter(m => m.status === 'open').length
    const receipt = bizMsgs.flatMap(m => m.receipts).find(r => r?.bizId === bizId)
    const pending = bizMsgs.filter(m => {
      const r = m.receipts?.find(r => r.bizId === bizId)
      return r?.status === 'pending'
    }).length
    return { open, pending, total: bizMsgs.length }
  }

  return (
    <AppShell title="사업장 현황">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">전체 {businesses.length}개 사업장</p>
          {isAdmin && (
            <button onClick={() => { setEditBiz(null); setShowForm(true) }}
              className="flex items-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
              <Plus size={16}/> 사업장 추가
            </button>
          )}
        </div>

        <div className="space-y-2">
          {businesses.map(biz => {
            const { open, pending, total } = getBizStats(biz.id)
            return (
              <button key={biz.id}
                onClick={() => router.push(`/businesses/${biz.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-primary-200 transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-primary-600"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{biz.name}</p>
                        {pending > 0 && (
                          <span className="badge-pending text-red-600 bg-red-50">미접수 {pending}</span>
                        )}
                        {open > 0 && (
                          <span className="badge-open">진행중 {open}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {biz.repName && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="text-gray-400">대표</span> {biz.repName}
                          </span>
                        )}
                        {biz.phone && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone size={10} className="text-gray-400"/> {biz.phone}
                          </span>
                        )}
                        {biz.address && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin size={10} className="text-gray-400"/> {biz.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <>
                        <button onClick={e => { e.stopPropagation(); setEditBiz(biz); setShowForm(true) }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100">
                          <Edit2 size={14}/>
                        </button>
                        <button onClick={e => { e.stopPropagation(); if (confirm(`'${biz.name}' 삭제할까요?`)) deleteBusiness(biz.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50">
                          <Trash2 size={14}/>
                        </button>
                      </>
                    )}
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 ml-1"/>
                  </div>
                </div>
              </button>
            )
          })}
          {businesses.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              {isAdmin ? '+ 사업장 추가 버튼을 눌러 등록하세요' : '등록된 사업장이 없습니다'}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <BusinessFormModal
          initial={editBiz}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}
    </AppShell>
  )
}

function BusinessFormModal({ initial, onClose, onSaved }: {
  initial: Business | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name,    setName]    = useState(initial?.name    ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [repName, setRepName] = useState(initial?.repName ?? '')
  const [phone,   setPhone]   = useState(initial?.phone   ?? '')
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    if (initial?.id) {
      await updateBusiness(initial.id, { name, address, repName, phone })
    } else {
      await addBusiness({ name, address, repName, phone } as Omit<Business, 'id'>)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{initial ? '사업장 수정' : '사업장 추가'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {[
            { label: '사업장명 *', value: name,    onChange: setName,    placeholder: '○○ 지점' },
            { label: '주소',       value: address, onChange: setAddress, placeholder: '서울시 강남구...' },
            { label: '대표자명',   value: repName, onChange: setRepName, placeholder: '홍길동' },
            { label: '연락처',     value: phone,   onChange: setPhone,   placeholder: '010-0000-0000' },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input value={f.value} onChange={e => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>
          ))}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">
            취소
          </button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="flex-1 bg-primary-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
