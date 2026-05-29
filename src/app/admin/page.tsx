'use client'
// src/app/admin/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenUsers, listenBusinesses, upsertUser, updateBusiness } from '@/lib/db'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { AppUser, Business, UserRole } from '@/types'
import { UserPlus, Edit2, Check, X, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'

export default function AdminPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [users,      setUsers]      = useState<AppUser[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showAdd,    setShowAdd]    = useState(false)
  const [editId,     setEditId]     = useState<string | null>(null)

  const [newEmail,  setNewEmail]  = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [newName,   setNewName]   = useState('')
  const [newRole,   setNewRole]   = useState<UserRole>('HQ_MEMBER')
  const [newBizId,  setNewBizId]  = useState('')
  const [adding,    setAdding]    = useState(false)
  const [addError,  setAddError]  = useState('')

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { router.replace('/dashboard'); return }
    const u1 = listenUsers(setUsers)
    const u2 = listenBusinesses(setBusinesses)
    return () => { u1(); u2() }
  }, [user, router])

  const handleAddUser = async () => {
    if (!newEmail || !newPw || !newName) { setAddError('이름, 이메일, 비밀번호를 모두 입력해주세요'); return }
    if (newRole === 'BIZ_REP' && !newBizId) { setAddError('담당 사업장을 선택해주세요'); return }
    setAdding(true); setAddError('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmail, newPw)
      const newUser: AppUser = {
        uid: cred.user.uid, email: newEmail, name: newName,
        role: newRole,
        ...(newRole === 'BIZ_REP' && newBizId ? { bizId: newBizId } : {}),
      }
      await setDoc(doc(db, 'users', cred.user.uid), newUser)
      // 사업장대표로 지정된 경우 사업장 대표자 정보 자동 연동
      if (newRole === 'BIZ_REP' && newBizId) {
        await updateBusiness(newBizId, { repName: newName, repPhone: newEmail, repUid: cred.user.uid })
      }
      setShowAdd(false)
      setNewEmail(''); setNewPw(''); setNewName(''); setNewBizId('')
      setNewRole('HQ_MEMBER')
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : '계정 생성 실패')
    } finally {
      setAdding(false)
    }
  }

  // 역할 변경 시 사업장 대표자 정보 자동 연동
  const updateRole = async (u: AppUser, role: UserRole, bizId?: string) => {
    const updated: AppUser = { ...u, role, ...(bizId ? { bizId } : { bizId: undefined }) }
    await upsertUser(updated)
    // 사업장대표로 변경된 경우 사업장 대표자 정보 자동 연동
    if (role === 'BIZ_REP' && bizId) {
      await updateBusiness(bizId, { repName: u.name, repUid: u.uid })
    }
    setEditId(null)
  }

  const roleLabel = (r: UserRole) => {
    if (r === 'ADMIN')      return '관리자'
    if (r === 'HQ_CHIEF')   return '본부장'
    if (r === 'HQ_MEMBER')  return '본부멤버'
    return '사업장대표'
  }

  const roleBadgeClass = (r: UserRole) => {
    if (r === 'ADMIN')     return 'bg-primary-100 text-primary-800'
    if (r === 'HQ_CHIEF')  return 'bg-amber-100 text-amber-800'
    if (r === 'HQ_MEMBER') return 'bg-blue-100 text-blue-800'
    return 'bg-green-100 text-green-800'
  }

  const selectedBiz = businesses.find(b => b.id === newBizId)

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-semibold text-gray-900">멤버 관리</h1>
              <ShieldCheck className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-sm text-gray-500">계정 추가 및 역할 설정 (관리자 전용)</p>
          </div>
          <button onClick={() => setShowAdd(v => !v)} className="btn btn-primary">
            <UserPlus className="w-4 h-4" /> 계정 추가
          </button>
        </div>

        {/* 역할 안내 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {([
            { role: 'ADMIN',      desc: '계정/권한/사업장 관리' },
            { role: 'HQ_CHIEF',   desc: '전달 발송, 현황 조회' },
            { role: 'HQ_MEMBER',  desc: '전달 발송, 현황 조회' },
            { role: 'BIZ_REP',    desc: '내 사업장 접수/답변' },
          ] as const).map(({ role, desc }) => (
            <div key={role} className="card p-3">
              <span className={clsx('text-[11px] font-medium px-2 py-0.5 rounded-full', roleBadgeClass(role))}>
                {roleLabel(role)}
              </span>
              <p className="text-xs text-gray-400 mt-1.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* 계정 추가 폼 */}
        {showAdd && (
          <div className="card p-4 mb-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-gray-900">새 계정 추가</h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">역할 *</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['HQ_MEMBER', 'HQ_CHIEF', 'BIZ_REP', 'ADMIN'] as UserRole[]).map(r => (
                  <button key={r} onClick={() => { setNewRole(r); if (r !== 'BIZ_REP') setNewBizId('') }}
                    className={clsx('py-2 rounded-lg border text-xs font-medium transition-all',
                      newRole === r ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50')}>
                    {roleLabel(r)}
                  </button>
                ))}
              </div>
            </div>

            {newRole === 'BIZ_REP' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">담당 사업장 * (먼저 선택하세요)</label>
                {businesses.length === 0 ? (
                  <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                    ※ 먼저 사업장 목록에서 사업장을 추가해주세요
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {businesses.map(b => (
                      <button key={b.id} onClick={() => setNewBizId(b.id)}
                        className={clsx('flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all',
                          newBizId === b.id ? 'border-primary-400 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-200')}>
                        <span className={clsx('text-sm font-medium', newBizId === b.id ? 'text-primary-800' : 'text-gray-900')}>{b.name}</span>
                        <span className="text-xs text-gray-400">{b.repName} 대표</span>
                      </button>
                    ))}
                  </div>
                )}
                {newBizId && selectedBiz && (
                  <p className="text-xs text-primary-700 mt-2 font-medium">✓ {selectedBiz.name} 선택됨 → 사업장 대표자 정보가 자동 연동됩니다</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder={selectedBiz ? selectedBiz.repName : '홍길동'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이메일 *</label>
                <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@gmail.com" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">초기 비밀번호 * (6자 이상)</label>
                <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" />
              </div>
            </div>

            {addError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>}
            <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
              계정 생성 후 이메일과 비밀번호를 해당 사용자에게 직접 전달해주세요.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowAdd(false); setAddError('') }} className="btn">취소</button>
              <button onClick={handleAddUser} disabled={adding} className="btn btn-primary">
                {adding ? '생성 중...' : '계정 생성'}
              </button>
            </div>
          </div>
        )}

        {/* 사용자 목록 */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">
            전체 멤버 ({users.length}명)
          </div>
          <ul className="divide-y divide-gray-50">
            {users.map(u => (
              <li key={u.uid} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700 flex-shrink-0">
                  {u.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-medium text-gray-900">{u.name}</div>
                    {u.role === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-primary-500" />}
                  </div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </div>
                {editId === u.uid ? (
                  <EditRoleInline user={u} businesses={businesses} onSave={updateRole} onCancel={() => setEditId(null)} />
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={clsx('text-xs rounded-full px-2.5 py-0.5 font-medium', roleBadgeClass(u.role))}>
                      {roleLabel(u.role)}
                      {u.role === 'BIZ_REP' && u.bizId && businesses.find(b => b.id === u.bizId)
                        ? ` · ${businesses.find(b => b.id === u.bizId)?.name}` : ''}
                    </span>
                    {u.uid !== user?.uid && (
                      <button onClick={() => setEditId(u.uid)} className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  )
}

function EditRoleInline({ user, businesses, onSave, onCancel }: {
  user: AppUser; businesses: Business[]
  onSave: (u: AppUser, role: UserRole, bizId?: string) => void
  onCancel: () => void
}) {
  const [role,  setRole]  = useState<UserRole>(user.role)
  const [bizId, setBizId] = useState(user.bizId ?? '')
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <select className="input text-xs py-1 px-2 w-28" value={role} onChange={e => setRole(e.target.value as UserRole)}>
        <option value="HQ_MEMBER">본부멤버</option>
        <option value="HQ_CHIEF">본부장</option>
        <option value="BIZ_REP">사업장대표</option>
        <option value="ADMIN">관리자</option>
      </select>
      {role === 'BIZ_REP' && (
        <select className="input text-xs py-1 px-2 w-32" value={bizId} onChange={e => setBizId(e.target.value)}>
          <option value="">사업장 선택</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      <button onClick={() => onSave(user, role, bizId || undefined)} className="p-1 text-green-600 hover:text-green-800">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
