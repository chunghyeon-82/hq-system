export type UserRole = 'ADMIN' | 'HQ_CHIEF' | 'HQ_MEMBER' | 'BIZ_REP' | 'ETC'

export interface UserPermissions {
  canEditBusiness?: boolean
  canBroadcast?:    boolean
}

export interface AppUser {
  uid:          string
  email:        string
  name:         string
  role:         UserRole
  customRole?:  string
  bizId?:       string
  permissions?: UserPermissions
}

export interface Shareholder { name: string; shares: number }

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
  isHQ?:          boolean
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
  id:            string
  title:         string
  body:          string
  priority:      MessagePriority
  type:          MessageType
  authorUid:     string
  authorName:    string
  authorBizId?:  string
  targetBizIds:  string[]
  targetUid?:    string
  targetName?:   string
  status:        MessageStatus
  receipts:      Receipt[]
  replies:       Reply[]
  // 일정 첨부
  eventDate?:    string   // ISO 날짜 "YYYY-MM-DD"
  eventTime?:    string   // "HH:MM"
  eventTitle?:   string
  createdAt:     unknown
  updatedAt:     unknown
  // 링크 첨부
  linkUrl?:      string
  linkLabel?:    string
}

// ── 공지사항 ──────────────────────────────────────────
export type NoticePrefix = '본부' | '사업장'

export interface Notice {
  id:          string
  prefix:      NoticePrefix
  title:       string
  body:        string
  authorUid:   string
  authorName:  string
  expiresAt:   string   // ISO datetime
  createdAt:   unknown
  updatedAt?:  unknown
}

// ── 캘린더 일정 ───────────────────────────────────────
export type ReminderUnit = 'minutes' | 'hours' | 'days'

export interface EventReminder {
  value: number
  unit:  ReminderUnit
}

export interface CalendarEvent {
  id:            string
  title:         string
  date:          string   // "YYYY-MM-DD"
  time?:         string   // "HH:MM"
  memo?:         string
  ownerUid:      string
  ownerName:     string
  targetBizIds?: string[]   // 사업장에 공유된 경우
  reminder?:     EventReminder
  isDone:        boolean
  doneAt?:       string
  addedBy?:      Record<string, string>   // bizId → addedAt ISO
  createdAt:     unknown
  updatedAt?:    unknown
}

// ── 메시지 템플릿 ─────────────────────────────────────
export interface MessageTemplate {
  id:        string
  ownerUid:  string
  title:     string
  body:      string
  createdAt: unknown
}
