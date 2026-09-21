'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { Building2 } from 'lucide-react'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [email,      setEmail]      = useState('')
  const [pw,         setPw]         = useState('')
  const [err,        setErr]        = useState('')
  const [submitting, setSubmitting] = useState(false)

  // auth-context媛 user瑜?媛먯??섎㈃ ?먮룞 ?대룞
  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
  }, [user, loading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, pw)
      // ?깃났 ??useEffect媛 dashboard濡??대룞
    } catch {
      setErr('?대찓???먮뒗 鍮꾨?踰덊샇媛 ?щ컮瑜댁? ?딆뒿?덈떎.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary-600 text-white rounded-2xl p-3 mb-3">
            <Building2 size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">蹂몃? 愿由??쒖뒪??/h1>
          <p className="text-sm text-gray-500 mt-1">濡쒓렇?명븯???쒖옉?섏꽭??/p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">?대찓??/label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="example@email.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">鍮꾨?踰덊샇</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="?™™™™™™™? required />
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit" disabled={submitting}
            className="w-full bg-primary-600 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-primary-800 disabled:opacity-60 transition-colors">
            {submitting ? '濡쒓렇??以?..' : '濡쒓렇??}
          </button>
        </form>
      </div>
    </div>
  )
}

