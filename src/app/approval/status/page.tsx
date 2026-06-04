'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function StatusPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/approval/status/pending') }, [router])
  return null
}
