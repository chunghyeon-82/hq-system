export type UserRole = 'ADMIN' | 'HQ_CHIEF' | 'HQ_MEMBER' | 'BIZ_REP'

export interface UserPermissions {
  canEditBusiness?: boolean
  canBroadcast?:    boolean
}

export interface AppUser {
  uid:          string
  email:        string
  name:         string
  role:         UserRole
  bizId?:       string
  permissions?: UserPermissions
}

export interface Shareholder {
  name:   string
  shares: number
}

export interface Business {
  id:             string
  name:           string
  address?:       string
  repName?:       string
  repUid?:        string
  phone?:         string
  totalShares?:   number
  shareholders?:  Shareholder[]
  employeeCount?: number
  annualRevenue?: number
  isHQ?:          boolean   // 운영본부 여부 (본부 멤버 소속)
  createdAt?:     unknown
}

export type MessagePriority = 'normal' | 'urgent'
export type MessageStatus   = 'open' | 'done'
export type MessageType     = 'broadcast' | 'direct'

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
  type:         MessageType
  authorUid:    string
  authorName:   string
  authorBizId?: string
  targetBizIds: string[]
  targetUid?:   string
  targetName?:  string
  status:       MessageStatus
  receipts:     Receipt[]
  replies:      Reply[]
  createdAt:    unknown
  updatedAt:    unknown
}
