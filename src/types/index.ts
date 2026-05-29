export type UserRole = 'ADMIN' | 'HQ_CHIEF' | 'HQ_MEMBER' | 'BIZ_REP'

export interface AppUser {
  uid: string
  email: string
  name: string
  role: UserRole
  bizId?: string
}

export interface Business {
  id: string
  name: string
  address?: string
  repName?: string
  repUid?: string
  phone?: string
  createdAt?: unknown
}

export type MessagePriority = 'normal' | 'urgent'
export type MessageStatus   = 'open' | 'done'   // open=진행중, done=완결

export interface Receipt {
  bizId:      string
  bizName:    string
  status:     'pending' | 'received' | 'replied'
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
