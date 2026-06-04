declare module 'lunar-javascript' {
  export class Lunar {
    static fromDate(date: Date): Lunar
    getMonth(): number
    getDay(): number
    isLeap(): boolean
  }
  export class Solar {
    static fromDate(date: Date): Solar
  }
}
