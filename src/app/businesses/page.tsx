'use client'
// src/app/businesses/page.tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import BusinessForm from '@/components/BusinessForm'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, listenMessages } from '@/lib/db'
import type { Business, Message } from '@/types'
import { Plus, Users, MapPin, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

export default function BusinessesPage() {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [messages,   setMessages]   = useState<Message[]>([])
  const [showForm,   setShowForm]   = useState(false)

  const isHQ    = user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isChief = user?.role === 'HQ_CHIEF'

  useEffect(() => {
    const u1 = listenBusinesses(setBusinesses)
    const u2 = listenMessages(null, setMessages)
    return () => { u1(); u2() }
  }, [])

  const pendingByBiz = (bizId: string) =>
    messages.filter(m =>
      m.targetBizIds.includes(bizId) &&
      m.receipts.find(r => r.bizId === bizId)?.status === 'pending'
    ).length

  const visible = isHQ ? businesses : businesses.filter(b => b.id === user?.bizId)

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">사업장 목록</h1>
            <p className="text-sm text-gray-500 mt-0.5">총 {visible.length}개 사업장</p>
          </div>
          {isChief && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> 사업장 추가
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map(b => {
            const cnt = pendingByBiz(b.id)
            return (
              <Link key={b.id} href={`/businesses/${b.id}`}
                className="card p-4 hover:border-primary-200 transition-colors block">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center text-sm font-semibold text-primary-700">
                      {b.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{b.name}</div>
                      <div className="text-xs text-gray-500">{b.repName} 대표</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {cnt > 0 && (
                      <span className="text-[11px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                        미접수 {cnt}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {b.employees}명
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {b.address.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        {showForm && (
          <BusinessForm
            onClose={() => setShowForm(false)}
            onSaved={() => setShowForm(false)}
          />
        )}
      </div>
    </AppShell>
  )
}
