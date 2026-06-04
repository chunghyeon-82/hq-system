'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenRecipientContacts, addRecipientContact, deleteRecipientContact } from '@/lib/db'
import type { RecipientContact } from '@/types'
import { Plus, Trash2, Users, Search } from 'lucide-react'

export default function RecipientsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [contacts, setContacts] = useState<RecipientContact[]>([])
  const [query,    setQuery]    = useState('')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [org,      setOrg]      = useState('')
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    return listenRecipientContacts(user.uid, setContacts)
  }, [user, loading, router])

  const filtered = contacts.filter(c =>
    !query || c.name.includes(query) || c.email.includes(query) || (c.org ?? '').includes(query)
  )

  const handleAdd = async () => {
    if (!user || !name.trim() || !email.trim()) { alert('이름과 이메일을 입력해주세요'); return }
    if (!email.includes('@')) { alert('올바른 이메일 주소를 입력해주세요'); return }
    setSaving(true)
    await addRecipientContact({ name:name.trim(), email:email.trim(), org:org.trim()||undefined, ownerUid:user.uid })
    setName(''); setEmail(''); setOrg(''); setShowForm(false); setSaving(false)
  }

  return (
    <ApprovalShell title="수신자 관리">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">수신자 관리</h2>
            <p className="text-sm text-gray-500 mt-1">공문 작성 시 수신자/공람자로 바로 선택할 수 있습니다</p>
          </div>
          <button onClick={() => setShowForm(v=>!v)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-800 transition-colors">
            <Plus size={15}/> 추가
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">수신자 추가</h3>
            {[
              {label:'이름 *',  value:name,  set:setName,  ph:'예: 홍길동'},
              {label:'이메일 *',value:email, set:setEmail, ph:'예: example@org.kr'},
              {label:'소속기관',value:org,   set:setOrg,   ph:'예: 문화체육관광부'},
            ].map(f=>(
              <div key={f.label}>
                <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
                <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={()=>{setShowForm(false);setName('');setEmail('');setOrg('')}}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm">취소</button>
              <button onClick={handleAdd} disabled={saving||!name.trim()||!email.trim()}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
                {saving ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        )}

        {/* 검색 */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="이름, 이메일, 소속기관 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>

        {/* 목록 */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users size={36} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm">{query ? '검색 결과가 없습니다' : '등록된 수신자가 없습니다'}</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="divide-y divide-gray-50">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.email}{c.org ? ` · ${c.org}` : ''}</p>
                  </div>
                  <button onClick={async()=>{if(!confirm(`"${c.name}" 삭제?`))return;await deleteRecipientContact(c.id)}}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={14}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 text-right">총 {filtered.length}명</p>
      </div>
    </ApprovalShell>
  )
}
