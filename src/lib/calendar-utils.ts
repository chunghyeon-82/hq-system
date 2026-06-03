// ── 음력 변환 ──────────────────────────────────────────
// lunar-javascript 패키지 사용
let LunarLib: any = null
async function getLunarLib() {
  if (!LunarLib) {
    LunarLib = (await import('lunar-javascript')).default ?? (await import('lunar-javascript'))
  }
  return LunarLib
}

export async function getLunarDate(year: number, month: number, day: number): Promise<string> {
  try {
    const { Lunar } = await getLunarLib()
    const lunar = Lunar.fromDate(new Date(year, month - 1, day))
    const lm = lunar.getMonth()
    const ld = lunar.getDay()
    const isLeap = lunar.isLeap()
    return `${isLeap ? '윤' : '음'}${lm}/${ld}`
  } catch {
    return ''
  }
}

// ── 공휴일 API ─────────────────────────────────────────
export interface Holiday {
  date: string   // YYYYMMDD
  name: string
  isHoliday: boolean
}

const holidayCache: Record<string, Holiday[]> = {}

export async function fetchHolidays(year: number, month: number): Promise<Holiday[]> {
  const key = `${year}-${month}`
  if (holidayCache[key]) return holidayCache[key]

  try {
    const apiKey = process.env.NEXT_PUBLIC_HOLIDAY_API_KEY
    if (!apiKey) return []

    const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
      `?serviceKey=${encodeURIComponent(apiKey)}` +
      `&solYear=${year}` +
      `&solMonth=${String(month).padStart(2, '0')}` +
      `&_type=json` +
      `&numOfRows=20`

    const res  = await fetch(url)
    const json = await res.json()
    const items = json?.response?.body?.items?.item

    if (!items) { holidayCache[key] = []; return [] }

    const list = Array.isArray(items) ? items : [items]
    const holidays: Holiday[] = list.map((item: any) => ({
      date:      String(item.locdate),
      name:      item.dateName,
      isHoliday: item.isHoliday === 'Y',
    }))

    holidayCache[key] = holidays
    return holidays
  } catch (e) {
    console.error('공휴일 API 오류:', e)
    return []
  }
}

// 특정 날짜의 공휴일 이름 반환
export function getHolidayName(holidays: Holiday[], year: number, month: number, day: number): string | null {
  const dateStr = `${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`
  const found = holidays.find(h => h.date === dateStr)
  return found ? found.name : null
}
