'use client'
// src/components/BusinessForm.tsx
import { useState } from 'react'
import { addBusiness, updateBusiness } from '@/lib/db'
import type { Business, Shareholder, Officer } from '@/types'
import { Plus, Trash2, X } from 'lucide-react'

interface Props {
  initial?: Business
  onClose: () => void
  onSaved: () => void
}

const emptyBiz = (): Omit<Business, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '', repName: '', repPhone: '', repUid: '',
  employees: 0, established: '', address: '', businessType: '요식업',
  shareholders: [], officers: [],
})

export default function BusinessForm({ initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() =>
    initial
      ? (({ id, createdAt, updatedAt, ...rest }: Business) => rest)(initial)
      : emptyBiz()
  )
  const [saving, setSaving] = useState(false)

  const setField = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  // 주주
  const setShareholder = (i: number, k: keyof Shareholder, v: string | number) => {
    const next = [...form.shareholders]
    next[i] = { ...next[i], [k]: k === 'shares' || k === 'pct' ? Number(v) : v }
    setField('shareholders', next)
  }
  const addShareholder = () =>
    setField('shareholders', [...form.shareholders, { name: '', shares: 0, pct: 0 }])
  const removeShareholder = (i: number) =>
    setField('shareholders', form.shareholders.filter((_, idx) => idx !== i))

  // 임원
  const setOfficer = (i: number, k: keyof Officer, v: string) => {
    const next = [...form.officers]
    next[i] = { ...next[i], [k]: v }
    setField('officers', next)
  }
  const addOfficer = () =>
    setField('officers', [...form.officers, { name: '', title: '', termStart: '', termEnd: '' }])
  const removeOfficer = (i: number) =>
    setField('officers', form.officers.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!form.name || !form.repName) return
    setSaving(true)
    try {
      if (initial) {
        await updateBusiness(initial.id, form)
      } else {
        await addBusiness(form)
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 overflow-y-auto py-6 px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? '사업장 수정' : '사업장 추가'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          {/* 기본정보 */}
          <Section title="기본정보">
            <Row label="사업장명 *">
              <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="서울 1호점" />
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="대표자 *">
                <input className="input" value={form.repName} onChange={e => setField('repName', e.target.value)} placeholder="홍길동" />
              </Row>
              <Row label="대표자 연락처">
                <input className="input" value={form.repPhone} onChange={e => setField('repPhone', e.target.value)} placeholder="010-0000-0000" />
              </Row>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Row label="직원 수">
                <input className="input" type="number" value={form.employees} onChange={e => setField('employees', Number(e.target.value))} min={0} />
              </Row>
              <Row label="설립일">
                <input className="input" type="date" value={form.established} onChange={e => setField('established', e.target.value)} />
              </Row>
            </div>
            <Row label="주소">
              <input className="input" value={form.address} onChange={e => setField('address', e.target.value)} placeholder="서울 강남구..." />
            </Row>
            <Row label="업종">
              <input className="input" value={form.businessType} onChange={e => setField('businessType', e.target.value)} />
            </Row>
          </Section>

          {/* 주주명부 */}
          <Section title="주주명부">
            {form.shareholders.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input flex-1" placeholder="주주명" value={s.name} onChange={e => setShareholder(i, 'name', e.target.value)} />
                <input className="input w-28" type="number" placeholder="주식수" value={s.shares || ''} onChange={e => setShareholder(i, 'shares', e.target.value)} />
                <input className="input w-20" type="number" placeholder="지분%" value={s.pct || ''} onChange={e => setShareholder(i, 'pct', e.target.value)} />
                <button onClick={() => removeShareholder(i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={addShareholder} className="btn text-xs">
              <Plus className="w-3.5 h-3.5" /> 주주 추가
            </button>
          </Section>

          {/* 임원정보 */}
          <Section title="임원정보">
            {form.officers.map((o, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input className="input w-24" placeholder="성명" value={o.name} onChange={e => setOfficer(i, 'name', e.target.value)} />
                <input className="input flex-1 min-w-[100px]" placeholder="직책 (예: 대표이사)" value={o.title} onChange={e => setOfficer(i, 'title', e.target.value)} />
                <input className="input w-36" type="date" placeholder="임기시작" value={o.termStart} onChange={e => setOfficer(i, 'termStart', e.target.value)} />
                <input className="input w-36" type="date" placeholder="임기만료" value={o.termEnd} onChange={e => setOfficer(i, 'termEnd', e.target.value)} />
                <button onClick={() => removeOfficer(i)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={addOfficer} className="btn text-xs">
              <Plus className="w-3.5 h-3.5" /> 임원 추가
            </button>
          </Section>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn">취소</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
            {saving ? '저장 중...' : initial ? '수정 완료' : '사업장 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1.5 border-b border-gray-100">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
