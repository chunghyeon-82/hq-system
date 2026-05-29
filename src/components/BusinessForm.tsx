'use client'
import { useState } from 'react'
import { addBusiness, updateBusiness } from '@/lib/db'
import type { Business } from '@/types'

interface Props {
  initial?: Business | null
  onClose: () => void
  onSaved: () => void
}

export default function BusinessForm({ initial, onClose, onSaved }: Props) {
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
