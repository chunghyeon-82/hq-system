'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Building2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pw, setPw]       = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, pw)
      router.replace('/dashboard')
    } catch {
      setErr('이메일 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary-600 text-white rounded-2xl p-3 mb-3">
            <Building2 size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">본부 관리 시스템</h1>
          <p className="text-sm text-gray-500 mt-1">로그인하여 시작하세요</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="example@email.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="••••••••" required />
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-primary-600 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-primary-800 disabled:opacity-60 transition-colors">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
