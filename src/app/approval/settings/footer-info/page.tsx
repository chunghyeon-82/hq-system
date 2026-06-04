'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { saveFooterInfo, getFooterInfo } from '@/lib/db'
import type { FooterInfo } from '@/types'
import { Save, CheckCircle2 } from 'lucide-react'

const DEFAULT: FooterInfo = { zipCode:'', address:'', phone:'', fax:'', email:'', homepage:'', orgName:'', sealOrgName:'' }

export default function FooterInfoPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [info,   setInfo]   = useState<FooterInfo>(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    getFooterInfo(user.uid).then(fi => { if (fi) setInfo(fi) })
  }, [user, loading, router])

  const set = (k: keyof FooterInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInfo(prev => ({ ...prev, [k]: e.target.value }))

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    await saveFooterInfo(user.uid, info)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <ApprovalShell title="하단 발신 정보">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">하단 발신 정보 등록</h2>
          <p className="text-sm text-gray-500 mt-1">저장하면 공문 작성 시 자동으로 입력됩니다</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          {[
            { label:'조직명',      key:'orgName',     ph:'예: 총부사업기관 원창' },
            { label:'직인 위 조직명', key:'sealOrgName', ph:'예: 기획운영본부장' },
            { label:'우편번호',    key:'zipCode',     ph:'예: 54536' },
            { label:'주소',        key:'address',     ph:'예: 전북 익산시 익산대로 501' },
            { label:'전화',        key:'phone',       ph:'예: 063-842-3844' },
            { label:'전송(팩스)',  key:'fax',         ph:'예: 063-857-3844' },
            { label:'전자우편',    key:'email',       ph:'예: example@won.or.kr' },
            { label:'홈페이지',    key:'homepage',    ph:'예: www.example.or.kr' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">{f.label}</label>
              <input value={info[f.key as keyof FooterInfo]} onChange={set(f.key as keyof FooterInfo)}
                placeholder={f.ph}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {saved ? <><CheckCircle2 size={16}/> 저장됨</> : saving ? '저장 중...' : <><Save size={16}/> 저장하기</>}
        </button>
      </div>
    </ApprovalShell>
  )
}
