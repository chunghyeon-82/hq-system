export type UserRole = 'ADMIN' | 'HQ_CHIEF' | 'HQ_MEMBER' | 'BIZ_REP'

export interface UserPermissions {
  canEditBusiness?: boolean  // 사업장 정보 수정 권한
  canBroadcast?:    boolean  // 전체 메시지 발송 권한
}

export interface AppUser {
  uid:         string
  email:       string
  name:        string
  role:        UserRole
  bizId?:      string
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
  createdAt?:     unknown
}

export type MessagePriority = 'normal' | 'urgent'
export type MessageStatus   = 'open' | 'done'
export type MessageType     = 'broadcast' | 'direct'  // broadcast=전체/다수, direct=1:1

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
  id:             string
  title:          string
  body:           string
  priority:       MessagePriority
  type:           MessageType
  authorUid:      string
  authorName:     string
  authorBizId?:   string   // 사업장 대표가 보낸 경우
  targetBizIds:   string[] // broadcast용
  targetUid?:     string   // direct용: 수신 본부 멤버 uid
  targetName?:    string   // direct용: 수신 본부 멤버 이름
  status:         MessageStatus
  receipts:       Receipt[]
  replies:        Reply[]
  createdAt:      unknown
  updatedAt:      unknown
}
