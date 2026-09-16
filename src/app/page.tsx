'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Root() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    if (loading) return
    if (redirected.current) return
    redirected.current = true
    router.replace(user ? '/dashboard' : '/login')
  }, [user, loading, router])

  return null
}
