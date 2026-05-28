// src/types/index.ts

export type UserRole = 'ADMIN' | 'HQ_CHIEF' | 'HQ_MEMBER' | 'BIZ_REP'

export interface AppUser {
  uid: string
  email: string
  name: string
  role: UserRole
  bizId?: string   // BIZ_REP 전용
}

// ── 사업장 ──────────────────────────────────────────────
export interface Shareholder {
  name:   string
  shares: number
  pct:    number
}

export interface Officer {
  name:      string
  title:     string
  termStart: string   // 'YYYY-MM-DD'
  termEnd:   string
}

export interface Business {
  id:           string
  name:         string
  repName:      string
  repPhone:     string
  repUid?:      string   // 연동된 사업장대표 uid
  employees:    number
  established:  string
  address:      string
  businessType: string
  shareholders: Shareholder[]
  officers:     Officer[]
  createdAt:    string
  updatedAt:    string
}

// ── 메시지 ──────────────────────────────────────────────
export type MessagePriority = 'normal' | 'urgent'
export type MessageStatus   = 'pending' | 'received' | 'replied'

export interface Receipt {
  bizId:     string
  bizName:   string
  status:    MessageStatus  // 'pending' | 'received' | 'replied'
  receivedAt?: string
  repliedAt?:  string
}

export interface Reply {
  id:       string
  fromUid:  string
  fromName: string
  role:     UserRole
  text:     string
  createdAt: string
}

export interface Message {
  id:          string
  title:       string
  body:        string
  priority:    MessagePriority
  fromUid:     string
  fromName:    string
  fromRole:    UserRole
  targetBizIds: string[]   // ['all'] or specific ids
  receipts:    Receipt[]   // 사업장별 접수 현황
  replies:     Reply[]
  createdAt:   string
  updatedAt:   string
}
