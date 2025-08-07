import type { LoongCalendarManager } from '..'
import { LoongCalendarScheduleStatus, type LoongScheduleBaseData, type LoongScheduleLoopData, type LoongScheduleOnceData } from '../types'
import { getDate0000, LRUCache } from './utils'

export class TimeRange {
  readonly schedule: LoongSchedule
  readonly startTime: Date
  readonly endTime: Date
  readonly startTimestamp: number
  readonly endTimestamp: number
  readonly date: string
  readonly y: string
  readonly m: string
  readonly d: string

  constructor(schedule: LoongSchedule, startTime: Date, endTime: Date) {
    this.schedule = schedule
    this.startTime = startTime
    this.endTime = endTime
    this.startTimestamp = startTime.getTime()
    this.endTimestamp = endTime.getTime()
    this.date = startTime.toLocaleDateString()
    this.y = startTime.getFullYear().toString()
    this.m = (startTime.getMonth() + 1).toString().padStart(2, '0')
    this.d = startTime.getDate().toString().padStart(2, '0')
  }
}

export class LoongSchedule {
  static readonly MIN_TIMESTAMP = 0
  static readonly DEF_MIN_TIMESTAMP = 0
  static readonly MAX_TIMESTAMP = 253402271999999
  static readonly DEF_MAX_TIMESTAMP = 253402271999999
  private __loong: LoongCalendarManager
  private __status: LoongCalendarScheduleStatus = LoongCalendarScheduleStatus.READY
  readonly once: boolean
  readonly id: string
  readonly title: string
  readonly content: string
  readonly category: string | number
  readonly meta: any
  private __color: string = 'blue'
  private __lcrontab:
    | string
    | [string]
    | [string, Date]
    | [string, Date, Date]
    | [string, false, Date]
  /** 在不合法的（LoongCalendarScheduleStatus.FAILURE）schedule里面不存在，此处简化为强制存在 */
  readonly scheduleBaseData!: LoongScheduleBaseData

  get status(): LoongCalendarScheduleStatus {
    return this.__status
  }

  get color(): string {
    return this.__color
  }

  private __simpleCheckedDate: LRUCache<string, boolean> = new LRUCache(20)

  /**
   * ### 创建一个单次日程
   * - 重复的id后者会覆盖前者。
   * - title和content绘制于canvas，均不支持html格式。
   * - 单次日程lcrontab必须为false。
   * - startTime和endTime如果是非法时间则日程不会创建。
   * - endTime必须晚于startTime（不能相等），否则日程不会创建。
   * ```ts
   * new LoongSchedule(calendar, 'id', 'title', 'content', 'category', new Date('2025-05-31 12:00:00'), new Date('2025-06-01 12:00:00'), {})
   * ```
   * @param calendar LoongCalendarManager
   * @param id id
   * @param title title
   * @param content content
   * @param category 分类
   * @param startTime 单次日程的起始时刻
   * @param endTime 单次日程的结束时刻
   * @param meta 其他信息
   */
  constructor(
    calendar: LoongCalendarManager,
    id: string,
    title: string,
    content: string,
    category: string | number,
    startTime: Date,
    endTime: Date,
    meta?: Record<any, any>
  )
  /**
   * ### 创建一个循环日程
   * - 重复的id后者会覆盖前者。
   * - title和content绘制于canvas，均不支持html格式。
   * - 循环日程lcrontab的string变量与crontab很相似：'* * * *'。
   *   1. 分别表示：日期（1-31），月（1-12），周（0-7，其中 0 和 7 都代表星期天），年（1970-9999）。
   *     1. \*： 表示任意。
   *     2. -：表示一个范围。例如，9-17 表示从 9 到 17。
   *     3. ,：表示多个值。例如，1,3,5 表示 1、3 和 5。
   *     4. /：表示步长。例如，*\/3 表示每隔3天，如果使用步长，则必须设置起始时间。
   * - 循环日程lcrontab如果是数组：
   *   1. 数组长度为1，元素为string，与直接设置string相同（下同）。
   *   2. 数组长度为2，第二个元素为Date，为日程的截止时间（不设置起始时间则之前的循环日程不会显示）。
   *   3. 数组长度为3，第三个元素为Date，为日程的起始时间（可以显示之前已经经理过的循环日程）。
   *   4. 数组长度为3，第二个元素为false，第三个元素为Date，则第三个元素为日程的起始时间，且没有截止时间（可以显示之前已经经理过的循环日程）。
   * - startTime和endTime格式如下：字符串类型，'h:m:s'分别代表时、分、秒：'01:00:00'（写为'1:0:0'也有效）代表一点整。
   * - startTime和endTime如果是非法时间则日程不会创建。
   * - endTime必须晚于startTime（不能相等），否则日程不会创建。
   * - 循环日程不支持创建跨天的日程。
   * @param calendar LoongCalendar
   * @param id id
   * @param title title
   * @param content content
   * @param startTime 起始时间
   * @param endTime 结束时间
   * @param category 分类
   * @param lcrontab 循环方式
   * @param meta 其他信息
   */
  constructor(
    calendar: LoongCalendarManager,
    id: string,
    title: string,
    content: string,
    category: string | number,
    startTime: string,
    endTime: string,
    lcrontab:
      | string
      | [string]
      | [string, Date]
      | [string, Date, Date]
      | [string, false, Date],
    meta?: Record<any, any>,
  )
  constructor(
    calendar: LoongCalendarManager,
    id: string,
    title: string,
    content: string,
    category: string | number,
    startTime: Date | string,
    endTime: Date | string,
    param1?:
      | string
      | [string]
      | [string, Date]
      | [string, Date, Date]
      | [string, false, Date]
      | Record<any, any>,
    param2?: Record<any, any>
  ) {
    this.__loong = calendar
    this.id = id
    this.title = title
    this.content = content
    this.category = category
    if (param1 !== undefined && typeof param1 !== 'string' && !Array.isArray(param1)) {
      /** 是once模式 */
      this.once = true
    } else {
      /** 是loop模式 */
      this.once = false
    }
    this.__lcrontab = param1 as (string
      | [string]
      | [string, Date]
      | [string, Date, Date]
      | [string, false, Date])
    this.meta = this.once ? param1 : param2
    let res: LoongScheduleBaseData | null = null
    if (this.once && startTime instanceof Date && endTime instanceof Date) {
      res = this.decodeScheduleOnceData(new Date(startTime), new Date(endTime))
    } else if (!this.once && typeof startTime === 'string' && typeof endTime === 'string') {
      res = this.decodeScheduleLoopData(startTime, endTime)
    }
    if (res === null) {
      /** 日程初始化失败 */
      console.warn(this.id, '日程初始化失败')
      this.__status = LoongCalendarScheduleStatus.FAILURE
      return
    }
    this.scheduleBaseData = res
    /** 将日程放入日程管理器 */
    this.__status = this.__loong.manager.addSchedule(this, this.scheduleBaseData) ? LoongCalendarScheduleStatus.SUCCESS : LoongCalendarScheduleStatus.FAILURE
    /** 获取日程颜色 */
    this.updateScheduleColor()
    this.__loong.on('theme-change', this.updateScheduleColor, this)
  }

  private updateScheduleColor() {
    this.__color = this.__loong.options.getColor(this.category)
  }

  /**
   * 简单检查是否渲染，*不对间隔的循环日常进行检查，一律返回true*
   * @param date 某一天
   * @returns 是否渲染
   */
  simpleCheckRender(date: Date): boolean {
    if (this.__status === LoongCalendarScheduleStatus.FAILURE) return false
    const key = date.toLocaleDateString()
    if (this.__simpleCheckedDate.has(key)) return this.__simpleCheckedDate.get(key) as boolean
    if (this.once) {
      /** 单次日程 */
      const data = this.scheduleBaseData as LoongScheduleOnceData
      const st0000 = getDate0000(data.startTime)
      const et0000 = getDate0000(data.endTime)
      if (st0000 <= date && et0000 >= date) {
        /** date在本日程内 */
        this.__simpleCheckedDate.set(key, true)
        return true
      }
    } else {
      /** 循环日程 */
      const data = this.scheduleBaseData as LoongScheduleLoopData
      if (data.begin <= date && data.end >= date) {
        /** date在本日程内 */
        const everydate = data.everydate === true ? true : Array.isArray(data.everydate) ? date.getDate() in data.everydate : true
        if (!everydate) {
          this.__simpleCheckedDate.set(key, false)
          return false
        }
        const everyweek = data.everyweek === true ? true : Array.isArray(data.everyweek) ? date.getDay() in data.everyweek : true
        if (!everyweek) {
          this.__simpleCheckedDate.set(key, false)
          return false
        }
        const everymonth = data.everymonth === true ? true : Array.isArray(data.everymonth) ? date.getMonth() + 1 in data.everymonth : true
        if (!everymonth) {
          this.__simpleCheckedDate.set(key, false)
          return false
        }
        const everyyear = data.everyyear === true ? true : Array.isArray(data.everyyear) ? date.getFullYear() in data.everyyear : true
        if (!everyyear) {
          this.__simpleCheckedDate.set(key, false)
          return false
        }
        this.__simpleCheckedDate.set(key, true)
        return true
      }
    }
    this.__simpleCheckedDate.set(key, false)
    return false
  }

  /**
   * 传入一个日期，获取日期下本日程的时间区间
   *
   * - 单次日程不存在返回null
   * - *循环日程不会对此进行检查，调用此方法前应该经过检查*
   * @param date 某一天
   */
  getTimeRange(date: Date): TimeRange | null {
    if (this.__status === LoongCalendarScheduleStatus.FAILURE) return null
    if (this.once) {
      /** 单次日程 */
      const data = this.scheduleBaseData as LoongScheduleOnceData
      const st0000 = getDate0000(data.startTime)
      const et0000 = getDate0000(data.endTime)
      if (st0000 <= date && et0000 >= date) {
        /** date在本日程内 */
        const y = date.getFullYear().toString()
        const m = (date.getMonth() + 1).toString().padStart(2, '0')
        const d = date.getDate().toString().padStart(2, '0')
        const tr = data.timeRange.find(t => t.y === y && t.m === m && t.d === d)
        if (tr !== undefined) return tr
      }
    } else {
      /** 循环日程 */
      const data = this.scheduleBaseData as LoongScheduleLoopData
      const tsDate = new Date(date)
      const teDate = new Date(date)
      tsDate.setHours(...data.startTime, 0)
      teDate.setHours(...data.endTime, 0)
      return new TimeRange(this, tsDate, teDate)
    }
    return null
  }

  private decodeScheduleOnceData(startTime: Date, endTime: Date): null | LoongScheduleOnceData {
    if (startTime >= endTime) return null
    if (Number.isNaN(startTime.getTime()) || startTime.getTime() < LoongSchedule.MIN_TIMESTAMP || endTime.getTime() > LoongSchedule.MAX_TIMESTAMP) return null
    if (Number.isNaN(startTime.getTime()) || endTime.getTime() < LoongSchedule.MIN_TIMESTAMP || endTime.getTime() > LoongSchedule.MAX_TIMESTAMP) return null
    const timeRange = this.splitTimeByDay(startTime, endTime)
    const date: [string, string, string][] = timeRange.map((tr) => [tr.y, tr.m, tr.d])
    return {
      startTime,
      endTime,
      timeRange,
      date
    }
  }

  private decodeScheduleLoopData(startTime: string, endTime: string): null | LoongScheduleLoopData {
    let crontab: string
    if (typeof this.__lcrontab === 'string') {
      crontab = this.__lcrontab
    } else {
      crontab = this.__lcrontab[0]
    }
    const crontabItemList = crontab.split(' ').filter(i => i.length !== 0).map(i => i.trim())
    const crontabItemResList = crontabItemList.map(c => this.decodeCrontabItem(c))
    if (crontabItemResList.length !== 4) return null
    if (
      crontabItemResList[0] === null ||
      crontabItemResList[1] === null ||
      crontabItemResList[2] === null ||
      crontabItemResList[3] === null
    ) return null
    const begin = Array.isArray(this.__lcrontab) && this.__lcrontab.length === 3 ? this.__lcrontab[2] : new Date(LoongSchedule.DEF_MIN_TIMESTAMP)
    const end = Array.isArray(this.__lcrontab) && this.__lcrontab.length >= 2 && this.__lcrontab[1] instanceof Date ? this.__lcrontab[1] : new Date(LoongSchedule.DEF_MAX_TIMESTAMP)
    const sl = startTime.split(':').map(i => Number(i))
    const el = endTime.split(':').map(i => Number(i))
    if (sl.length !== 3 || sl.some(i => Number.isNaN(i))) return null
    if (el.length !== 3 || el.some(i => Number.isNaN(i))) return null
    const [sh, sm, ss] = sl
    const [eh, em, es] = el
    if (sh < 0 || sh > 23 || sm < 0 || sm > 59 || ss < 0 || ss > 59) return null
    if (eh < 0 || eh > 23 || em < 0 || em > 59 || es < 0 || es > 59) return null
    const ts = new Date(0)
    const te = new Date(0)
    ts.setHours(sh, sm, ss, 0)
    te.setHours(eh, em, es, 0)
    if (ts >= te) return null
    if (Array.isArray(crontabItemResList[0]) && !this.checkNumListRange(crontabItemResList[0], 1, 31)) return null
    if (Array.isArray(crontabItemResList[1]) && !this.checkNumListRange(crontabItemResList[1], 1, 12)) return null
    if (Array.isArray(crontabItemResList[2]) && !this.checkNumListRange(crontabItemResList[2], 0, 7)) return null
    if (Array.isArray(crontabItemResList[3]) && !this.checkNumListRange(crontabItemResList[3], 1970, 9999)) return null
    return {
      begin: getDate0000(begin),
      end: getDate0000(end),
      startTime: [sh, sm, ss],
      endTime: [eh, em, es],
      everydate: crontabItemResList[0],
      everymonth: crontabItemResList[1],
      everyweek: crontabItemResList[2],
      everyyear: crontabItemResList[3]
    }
  }

  private checkNumListRange(list: number[], min: number, max: number, diff: number = 0): boolean {
    if (diff !== 0) {
      for (let i = 0; i < list.length; i++) {
        list[i] += diff
      }
    }
    return list.every(i => i >= min && i <= max)
  }

  private decodeCrontabItem(crontab: string): null | true | number[] | number {
    if (crontab.length === 0) return null
    if (crontab === '*') return true
    if (crontab.includes('/') && crontab.startsWith('*/')) {
      const [, stepStr] = crontab.split('/')
      const step = Number(stepStr)
      if (Number.isNaN(step)) return null
      return step
    }
    if (crontab.includes('-')) {
      const [startStr, endStr] = crontab.split('-')
      const start = Number(startStr)
      const end = Number(endStr)
      if (Number.isNaN(start) || Number.isNaN(end)) return null
      const res: number[] = []
      for (let i = start; i <= end; i++) {
        res.push(i)
      }
      return res
    }
    if (crontab.includes(',')) {
      const res: number[] = crontab.split(',').map((item) => Number(item))
      if (res.some((item) => Number.isNaN(item))) return null
      return res
    }
    if (!Number.isNaN(Number(crontab))) {
      return [Number(crontab)]
    }
    return null
  }

  private splitTimeByDay(startTime: Date, endTime: Date): TimeRange[] {
    // 检查开始时间是否早于结束时间
    if (startTime > endTime) {
      throw new Error('Start time must be before end time')
    }
    let currentStart = new Date(startTime)
    const trList: TimeRange[] = []

    while (currentStart < endTime) {
      // 计算当天的结束时间（23:59:59）
      const currentEnd = new Date(currentStart)
      currentEnd.setHours(23, 59, 59, 999)

      // 如果当天的结束时间超过了总结束时间，调整为总结束时间
      if (currentEnd > endTime) {
        currentEnd.setTime(endTime.getTime())
      }

      // 添加当前时间区间到结果数组
      trList.push(new TimeRange(this, currentStart, currentEnd))

      // 更新下一天的开始时间
      currentStart = new Date(currentStart)
      currentStart.setDate(currentStart.getDate() + 1)
      currentStart.setHours(0, 0, 0, 0) // 设置为下一天的 00:00:00
    }
    return trList
  }

  display() {
    if (this.__status !== LoongCalendarScheduleStatus.HIDDEN) return
    this.__status = LoongCalendarScheduleStatus.SUCCESS
    this.updateScheduleColor()
    this.__loong.manager.addSchedule(this, this.scheduleBaseData)
    this.__loong.on('theme-change', this.updateScheduleColor)
  }

  hide() {
    if (this.__status !== LoongCalendarScheduleStatus.SUCCESS) return
    this.__loong.manager.removeSchedule(this, this.scheduleBaseData)
    this.__status = LoongCalendarScheduleStatus.HIDDEN
    this.__loong.off('theme-change', this.updateScheduleColor)
  }

  /**
   * 日程销毁方法（从日历上移除）
   * @returns
   */
  destroy() {
    if (this.__status !== LoongCalendarScheduleStatus.SUCCESS) return
    this.__loong.manager.removeSchedule(this, this.scheduleBaseData)
    this.__status = LoongCalendarScheduleStatus.DESTORYED
    this.__loong.off('theme-change', this.updateScheduleColor)
  }
}
