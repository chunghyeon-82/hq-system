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
  shares: number   // 주식수
  ratio?: number   // 지분율 (자동계산)
}

export interface Business {
  id:           string
  name:         string
  address?:     string
  repName?:     string
  repUid?:      string
  phone?:       string
  totalShares?: number         // 발행 총 주식수
  shareholders?: Shareholder[] // 주주 현황
  employeeCount?: number       // 총 직원수
  annualRevenue?: number       // 연매출 (만원)
  createdAt?: unknown
}

export type MessagePriority = 'normal' | 'urgent'
export type MessageStatus   = 'open' | 'done'

export interface Receipt {
  bizId:       string
  bizName:     string
  status:      'pending' | 'received' | 'replied'
  receivedAt?: string
  repliedAt?:  string
  hidden?:     boolean
  hiddenAt?:   string
}

export interface Reply {
  id:         string
  bizId:      string
  bizName:    string
  authorUid:  string
  authorName: string
  body:       string
  createdAt:  string
}

export interface Message {
  id:           string
  title:        string
  body:         string
  priority:     MessagePriority
  authorUid:    string
  authorName:   string
  targetBizIds: string[]
  status:       MessageStatus
  receipts:     Receipt[]
  replies:      Reply[]
  createdAt:    unknown
  updatedAt:    unknown
}
