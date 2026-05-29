'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenUsers, listenBusinesses } from '@/lib/db'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { AppUser, Business, UserRole } from '@/types'
import { UserPlus, ShieldCheck, Building2, User } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '관리자', HQ_CHIEF: '본부장', HQ_MEMBER: '본부멤버', BIZ_REP: '사업장대표'
}
const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  HQ_CHIEF: 'bg-primary-100 text-primary-700',
  HQ_MEMBER: 'bg-blue-100 text-blue-700',
  BIZ_REP: 'bg-green-100 text-green-700',
}

export default function AdminPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const [users,      setUsers]      = useState<AppUser[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showAdd,    setShowAdd]    = useState(false)
  const [newEmail,   setNewEmail]   = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [newName,    setNewName]    = useState('')
  const [newRole,    setNewRole]    = useState<UserRole>('HQ_MEMBER')
  const [newBizId,   setNewBizId]   = useState('')
  const [adding,     setAdding]     = useState(false)
  const [addError,   setAddError]   = useState('')

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { router.replace('/dashboard'); return }
    const u1 = listenUsers(setUsers)
    const u2 = listenBusinesses(setBusinesses)
    return () => { u1(); u2() }
  }, [user, router])

  const handleAddUser = async () => {
    if (!newEmail || !newPw || !newName) { setAddError('모두 입력해주세요'); return }
    if (newRole === 'BIZ_REP' && !newBizId) { setAddError('담당 사업장을 선택해주세요'); return }
    setAdding(true); setAddError('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmail, newPw)
      const newUser: AppUser = {
        uid: cred.user.uid, email: newEmail, name: newName, role: newRole,
        ...(newRole === 'BIZ_REP' && newBizId ? { bizId: newBizId } : {}),
      }
      await setDoc(doc(db, 'users', cred.user.uid), newUser)
      setShowAdd(false); setNewEmail(''); setNewPw(''); setNewName(''); setNewBizId(''); setNewRole('HQ_MEMBER')
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally { setAdding(false) }
  }

  return (
    <AppShell title="멤버 관리">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">전체 {users.length}명</p>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
            <UserPlus size={15}/> 계정 추가
          </button>
        </div>

        <div className="space-y-2">
          {users.map(u => (
            <div key={u.uid} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                {u.name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">{u.name}</span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role])}>
                    {ROLE_LABELS[u.role]}
                  </span>
                  {u.bizId && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Building2 size={10}/>
                      {businesses.find(b => b.id === u.bizId)?.name ?? u.bizId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">새 계정 추가</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="6자리 이상"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {newRole === 'BIZ_REP' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">담당 사업장</label>
                  <select value={newBizId} onChange={e => setNewBizId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">선택하세요</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              {addError && <p className="text-red-500 text-sm">{addError}</p>}
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={handleAddUser} disabled={adding}
                className="flex-1 bg-primary-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
                {adding ? '추가 중...' : '계정 추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
