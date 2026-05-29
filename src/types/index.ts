// src/types/index.ts

export type UserRole = 'ADMIN' | 'HQ_CHIEF' | 'HQ_MEMBER' | 'BIZ_REP'

export interface AppUser {
  uid: string
  email: string
  name: string
  role: UserRole
  bizId?: string
}

export interface Shareholder {
  name:   string
  shares: number
  pct:    number
}

export interface Officer {
  name:      string
  title:     string
  termStart: string
  termEnd:   string
}

export interface Business {
  id:           string
  name:         string
  repName:      string
  repPhone:     string
  repUid?:      string
  employees:    number
  established:  string
  address:      string
  businessType: string
  shareholders: Shareholder[]
  officers:     Officer[]
  createdAt:    string
  updatedAt:    string
}

export type MessagePriority = 'normal' | 'urgent'
export type MessageStatus   = 'pending' | 'received' | 'replied'

export interface Receipt {
  bizId:      string
  bizName:    string
  status:     MessageStatus
  receivedAt?: string
  repliedAt?:  string
  hiddenAt?:   string  // 숨김 처리 시각
  hidden?:     boolean // 해당 사업장에서 숨김 여부
}

export interface Reply {
  id:        string
  fromUid:   string
  fromName:  string
  role:      UserRole
  bizId?:    string  // 발신 사업장 (대표자 간 메시지용)
  text:      string
  createdAt: string
}

export interface Message {
  id:           string
  title:        string
  body:         string
  priority:     MessagePriority
  fromUid:      string
  fromName:     string
  fromRole:     UserRole
  fromBizId?:   string  // 대표자 간 메시지용
  targetBizIds: string[]
  receipts:     Receipt[]
  replies:      Reply[]
  createdAt:    string
  updatedAt:    string
}
