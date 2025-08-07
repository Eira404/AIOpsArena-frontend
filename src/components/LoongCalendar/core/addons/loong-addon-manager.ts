import {
  computed,
  ref,
  watch,
  type ComputedRef,
  type Ref,
  type WatchHandle,
  type WritableComputedRef
} from 'vue'
import type { LoongCalendarManager } from '../../'
import { LoongAddon } from './loong-addon'
import type { LoongSchedule, TimeRange } from '../schedule'
import { BPlusTree } from '../utils/BPlusTree'
import {
  LoongCalendarScheduleInManagerStatus,
  ScheduleBucketsType,
  type LoongCalendarManagerScheduleData,
  type LoongCalendarManagerScheduleDataLoop,
  type LoongCalendarManagerScheduleDataOnce
} from '../../types'
import { BinaryHeap, checkScheduleCanDisplay, getAllValueBiggerThan, getSundayOfTheWeek, intersection, LRUCache, now } from '../utils'
import type { BPlusTreeLeafNode } from '../utils/BPlusTree/leaf'

export class ScheduleRenderData {
  readonly id: string
  readonly schedule: LoongSchedule
  readonly timeRange: TimeRange
  readonly draw: boolean
  readonly startTimestamp: number
  readonly endTimestamp: number
  /** 宽度，单位：%，去renderer里面计算具体的px */
  width: number = 0
  /** 高度（duration），单位：s，去renderer里面计算具体的px */
  height: number = 0
  /** 顶部位置（startTime），单位：s，去renderer里面计算具体的px */
  top: number = 0
  /** 左侧位置，单位：%，去renderer里面计算具体的px */
  left: number = 0
  /** 第几列 */
  colIndex: number = 1
  /** 共几列*/
  colAmount: number = 1
  /** 占几列*/
  hasColAmount: number = 1
  constructor(schedule: LoongSchedule, timeRange: TimeRange, draw: boolean = true) {
    this.id = Math.random().toString(36).substring(2)
    this.schedule = schedule
    this.timeRange = timeRange
    this.startTimestamp = timeRange.startTimestamp
    this.endTimestamp = timeRange.endTimestamp
    this.draw = draw
  }
}

export class ScheduleBuckets {
  /** 桶的类型 */
  readonly type: ScheduleBucketsType
  /** 桶的数量 */
  private __amount: number
  /** 永远都可以获取的，不放入桶中 */
  private __alwaysSuccess: BPlusTree<LoongSchedule> = new BPlusTree()
  /** 桶图 */
  private __buckets: Map<number, BPlusTree<LoongSchedule>> = new Map()
  /** 存储每次都需要判断间隔的数据（设置了隔多久调用的那部分数据） */
  private __hardSchedules: BPlusTree<{
    begin: Date
    schedule: LoongSchedule
    id: string
    number: number
  }> = new BPlusTree()
  /** schedule id -> 日程起始时间 */
  private __id2begin: Map<string, Date> = new Map()

  constructor(type: ScheduleBucketsType) {
    this.type = type
    if (type === ScheduleBucketsType.YEAR) {
      /** 对于年，桶自动增加 */
      this.__amount = 0
    } else if (type === ScheduleBucketsType.MONTH) {
      this.__amount = 12
    } else if (type === ScheduleBucketsType.WEEK) {
      this.__amount = 7
    } else {
      this.__amount = 31
    }
    for (let i = 0; i < this.__amount; i++) {
      this.__buckets.set(i, new BPlusTree())
    }
  }

  clear() {
    this.__alwaysSuccess.clear()
    this.__buckets.forEach((bucket) => bucket.clear())
    this.__hardSchedules.clear()
    this.__id2begin.clear()
  }

  /**
   * 添加一个循环日程
   * @param schedule schedule
   * @param scheduleData LoongCalendarManagerScheduleDataLoop
   * @param data true | number[] | number
   * @returns this
   */
  addSchedule(
    schedule: LoongSchedule,
    scheduleData: LoongCalendarManagerScheduleDataLoop,
    data: true | number[] | number
  ): this {
    const begin = scheduleData.begin
    const end = scheduleData.end
    if (data === true) {
      /** 永远都可以获取的 */
      this.__alwaysSuccess.insert(end.getTime(), schedule)
    } else if (Array.isArray(data)) {
      /** 指定时间可以获取的 */
      data.forEach((item) => {
        /** month是1-12 date是1-31 都需要对数据减一 */
        if (this.type === ScheduleBucketsType.MONTH || this.type === ScheduleBucketsType.DATE) {
          item--
        }
        /** week是0-7 */
        if (this.type === ScheduleBucketsType.WEEK) item %= 7
        /** year是1970-9999 */
        if (this.type === ScheduleBucketsType.YEAR && !this.__buckets.has(item)) {
          this.__buckets.set(item, new BPlusTree())
        }
        const bucket = this.__buckets.get(item)
        if (bucket === undefined) {
          console.warn(
            `scheduleBuckets.addSchedule: bucket is undefined, type: ${this.type}, item: ${item}`
          )
          return
        }
        bucket.insert(end.getTime(), schedule)
      })
    } else {
      /** 隔一段时间后获取的 */
      if (data === 0) {
        /** 和永远都可以获取的一样 */
        this.__alwaysSuccess.insert(end.getTime(), schedule)
      } else if (begin !== null) {
        /** 隔一段时间后获取的 */
        this.__hardSchedules.insert(end.getTime(), { begin, schedule, id: schedule.id, number: data })
      } else {
        console.warn(`scheduleBuckets.addSchedule: insert fail, type: ${this.type}, data: ${data}`)
        return this
      }
    }
    this.__id2begin.set(schedule.id, begin === null ? new Date(0) : begin)
    return this
  }

  /**
   * 移除一个循环日程
   * @param schedule LoongSchedule
   * @returns boolean
   */
  removeSchedule(
    schedule: LoongSchedule,
    scheduleData: LoongCalendarManagerScheduleDataLoop,
    data: true | number[] | number
  ): boolean {
    const begin = scheduleData.begin
    const end = scheduleData.end
    this.__id2begin.delete(schedule.id)
    if (data === true) {
      return this.__alwaysSuccess.remove(end.getTime(), schedule)
    } else if (Array.isArray(data)) {
      let res: boolean = true
      data.forEach((item) => {
        /** month是1-12 date是1-31 都需要对数据减一 */
        if (this.type === ScheduleBucketsType.MONTH || this.type === ScheduleBucketsType.DATE) {
          item--
        }
        if (this.type === ScheduleBucketsType.WEEK) item %= 7
        if (this.type === ScheduleBucketsType.YEAR && !this.__buckets.has(item)) {
          this.__buckets.set(item, new BPlusTree())
        }
        const bucket = this.__buckets.get(item)
        if (bucket === undefined) {
          console.warn(
            `scheduleBuckets.removeSchedule: bucket is undefined, type: ${this.type}, item: ${item}`
          )
          return
        }
        res = bucket.remove(end.getTime(), schedule) && res
      })
      return res
    } else {
      /** 隔一段时间后获取的 */
      if (data === 0) {
        /** 和永远都可以获取的一样 */
        return this.__alwaysSuccess.remove(end.getTime(), schedule)
      } else {
        /** 隔一段时间后获取的 */
        return this.__hardSchedules.remove(end.getTime(), { begin, schedule, id: schedule.id, number: data })
      }
    }
  }

  /**
   * 检索某一天的日程，会返回符合该桶判断的日程，真正的日程需要全部桶取交集
   * @param date 选择的日期
   * @returns LoongSchedule[]
   */
  searchSchedule(date: Date): LoongSchedule[] {
    const res: LoongSchedule[] = []
    const y = date.getFullYear()
    const m = date.getMonth()
    const d = date.getDate()
    const w = date.getDay()
    /** 截止时间在这之前的日程不会加入 */
    const end = date.getTime()
    /** 将永远都可以获取的返回 */
    const value1 = this.__alwaysSuccess.searchFirstBigger(end)
    if (value1 !== undefined) {
      const s1 = getAllValueBiggerThan<LoongSchedule>(end, value1)
      /** 过滤掉begin晚于当前时间的日程 */
      res.push(
        ...s1.filter((s) => {
          const type = this.__id2begin.get(s.id)
          if (type === undefined) return false
          if (type.getTime() > end) return false
          return true
        })
      )
    }
    /** 将指定时间可以获取的返回 */
    let value2: BPlusTreeLeafNode<LoongSchedule> | undefined
    switch (this.type) {
      case ScheduleBucketsType.YEAR:
        value2 = this.__buckets.get(y)?.searchFirstBigger(end)
        break
      case ScheduleBucketsType.MONTH:
        value2 = this.__buckets.get(m)?.searchFirstBigger(end)
        break
      case ScheduleBucketsType.WEEK:
        value2 = this.__buckets.get(w)?.searchFirstBigger(end)
        break
      case ScheduleBucketsType.DATE:
        value2 = this.__buckets.get(d - 1)?.searchFirstBigger(end)
        break
    }
    if (value2 !== undefined) {
      const s2 = getAllValueBiggerThan<LoongSchedule>(end, value2)
      /** 过滤掉begin晚于当前时间的日程 */
      res.push(
        ...s2.filter((s) => {
          const type = this.__id2begin.get(s.id)
          if (type === undefined) return false
          if (type.getTime() > end) return false
          return true
        })
      )
    }
    /** 将隔一段时间后获取的返回 */
    const value3 = this.__hardSchedules.searchFirstBigger(end)
    if (value3 !== undefined) {
      const s3 = getAllValueBiggerThan<{
        begin: Date
        schedule: LoongSchedule
        id: string
        number: number
      }>(end, value3)
      /** 过滤掉begin晚于当前时间的日程 */
      /** 计算出符合要求的日程 */
      const s3t = s3
        .filter((s) => {
          const type = this.__id2begin.get(s.id)
          if (type === undefined) return false
          if (type.getTime() > end) return false
          return true
        })
        .filter((s) => {
          return checkScheduleCanDisplay(s.begin, date, this.type, s.number)
        })
        .map((s) => s.schedule)
      res.push(...s3t)
    }

    return res
  }
}

export class ScheduleDatabase {
  /** 数据库中包含的全部日程 */
  private __ids: Map<string, LoongSchedule> = new Map()
  /** 存放单次日程的图Map<year-month-date, Map<id, LoongSchedule>> */
  private __once: Map<string, Map<string, LoongSchedule>> = new Map()
  /** 存放循环日程设置年信息的桶 */
  private __years: ScheduleBuckets = new ScheduleBuckets(ScheduleBucketsType.YEAR)
  /** 存放循环日程设置月信息的桶 */
  private __months: ScheduleBuckets = new ScheduleBuckets(ScheduleBucketsType.MONTH)
  /** 存放循环日程设置周信息的桶 */
  private __weeks: ScheduleBuckets = new ScheduleBuckets(ScheduleBucketsType.WEEK)
  /** 存放循环日程设置日信息的桶 */
  private __dates: ScheduleBuckets = new ScheduleBuckets(ScheduleBucketsType.DATE)
  /** schedules列表的LRUCache缓存 */
  private __schedulesLRUCache: LRUCache<string, LoongSchedule[]> = new LRUCache<string, LoongSchedule[]>(50)

  clear() {
    this.__ids.clear()
    this.__once.clear()
    this.__years.clear()
    this.__months.clear()
    this.__weeks.clear()
    this.__dates.clear()
  }

  addSchedule(
    schedule: LoongSchedule,
    scheduleData: LoongCalendarManagerScheduleData,
    override: boolean = false
  ): this {
    if (this.__ids.has(schedule.id) && !override) {
      console.warn(`[LoongCalendar] 添加日程失败, 日程ID重复: ${schedule.id}`)
      return this
    }
    if (schedule.once) {
      const data = scheduleData as LoongCalendarManagerScheduleDataOnce
      data.date.forEach(([year, month, date]) => {
        const key = `${year}-${month}-${date}`
        if (!this.__once.has(key)) this.__once.set(key, new Map())
        const map = this.__once.get(key) as Map<string, LoongSchedule>
        map.set(schedule.id, schedule)
        /** 增加单次日程时，清空对应那天的数据 */
        this.__schedulesLRUCache.delete(key)
      })
    } else {
      /** 增加循环日程时，直接将cache清空，因为不确定涉及到了哪些时间 */
      this.__schedulesLRUCache.clear()
      const data = scheduleData as LoongCalendarManagerScheduleDataLoop
      this.__years.addSchedule(schedule, data, data.everyyear)
      this.__months.addSchedule(schedule, data, data.everymonth)
      this.__weeks.addSchedule(schedule, data, data.everyweek)
      this.__dates.addSchedule(schedule, data, data.everydate)
    }
    this.__ids.set(schedule.id, schedule)
    return this
  }

  removeSchedule(schedule: LoongSchedule, scheduleData: LoongCalendarManagerScheduleData): boolean {
    let res: boolean = true
    if (schedule.once) {
      const data = scheduleData as LoongCalendarManagerScheduleDataOnce
      data.date.forEach(([year, month, date]) => {
        const key = `${year}-${month}-${date}`
        if (!this.__once.has(key)) return
        const map = this.__once.get(key) as Map<string, LoongSchedule>
        res = map.delete(schedule.id) && res
        /** 移除单次日程时，清空对应那天的数据 */
        this.__schedulesLRUCache.delete(key)
      })
    } else {
      /** 移除循环日程时，直接将cache清空，因为不确定涉及到了哪些时间 */
      this.__schedulesLRUCache.clear()
      const data = scheduleData as LoongCalendarManagerScheduleDataLoop
      res = this.__years.removeSchedule(schedule, data, data.everyyear) && res
      res = this.__months.removeSchedule(schedule, data, data.everymonth) && res
      res = this.__weeks.removeSchedule(schedule, data, data.everyweek) && res
      res = this.__dates.removeSchedule(schedule, data, data.everydate) && res
    }
    return res
  }

  searchTimeRange(date: Date): TimeRange[] {
    const s = this.searchSchedule(date)
    const res = s.map(s => s.getTimeRange(date)).filter(t => t !== null)
    res.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    return res
  }

  searchSchedule(date: Date): LoongSchedule[] {
    const y = date.getFullYear().toString()
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const d = date.getDate().toString().padStart(2, '0')
    const key = `${y}-${m}-${d}`
    if (this.__schedulesLRUCache.has(key)) return this.__schedulesLRUCache.get(key) as LoongSchedule[]
    const oncesMap = this.__once.get(key)
    const onces = oncesMap ? [...oncesMap.values()] : []
    const years = this.__years.searchSchedule(date)
    const months = this.__months.searchSchedule(date)
    const weeks = this.__weeks.searchSchedule(date)
    const dates = this.__dates.searchSchedule(date)
    const loops = intersection((a, b) => a.id === b.id, years, months, weeks, dates)
    const res = [...(onces || []), ...loops]
    this.__schedulesLRUCache.set(key, res)
    return res
  }
}

export class Manager extends LoongAddon {
  /** 当前在即将加入或已经在数据库中的数据，这部分id不受到帧更新的影响，调用add或者remove直接修改数据 */
  private __schedulesStatus: Map<string, LoongCalendarScheduleInManagerStatus> = new Map()
  /** 日期是当前渲染的排在队列前部 */
  private __loongScheduleDataBinaryHeapCheckFunc = (a: [LoongSchedule, LoongCalendarManagerScheduleData], b: [LoongSchedule, LoongCalendarManagerScheduleData]): boolean => {
    if (this.type.value === 'date') {
      const date = new Date(this.renderWeek.value)
      return a[0].simpleCheckRender(date)
    } else {
      const date = new Date(this.renderWeek.value)
      const d = date.getDate()
      for (let i = 0; i < 7; i++) {
        const td = new Date(date)
        td.setDate(d + i)
        if (a[0].simpleCheckRender(td)) return true
      }
      return false
    }
  }
  /** 日期是当前渲染的排在队列前部 */
  private __dateBinaryHeapCheckFunc = (a: string, b: string): boolean => {
    if (this.type.value === 'date') {
      return a === this.renderDate.value.toLocaleDateString()
    } else {
      const date = new Date(this.renderWeek.value)
      const d = date.getDate()
      for (let i = 0; i < 7; i++) {
        const td = new Date(date)
        td.setDate(d + i)
        if (a === td.toLocaleDateString()) return true
      }
      return false
    }
  }
  /** 存放即将加入的日程，日程在当前的渲染时间上显示的排在前面 */
  private __readyToAddSchedules: BinaryHeap<[LoongSchedule, LoongCalendarManagerScheduleData]> = new BinaryHeap(this.__loongScheduleDataBinaryHeapCheckFunc)
  /** 存放即将移除的日程，日程在当前的渲染时间上显示的排在前面 */
  private __readyToRemoveSchedules: BinaryHeap<[LoongSchedule, LoongCalendarManagerScheduleData]> = new BinaryHeap(this.__loongScheduleDataBinaryHeapCheckFunc)
  /** 存放数据有更新的天，日程在当前的渲染时间上显示的排在前面，value是Date.toLocaleDateString获取的字符串 */
  private __readyToCalSizeDate: BinaryHeap<string> = new BinaryHeap(this.__dateBinaryHeapCheckFunc, true)
  /** 日程渲染数据图 */
  private __renderDataMap: Map<string, ScheduleRenderData[]> = new Map()
  /** 判断日程数据是否有更新 */
  private __renderDataUpdateMap: Map<string, boolean> = new Map()
  /** 日程数据库 */
  private __scheduleDatabase: ScheduleDatabase = new ScheduleDatabase()

  /** 管理器类型，页面日程显示 */
  readonly type: Ref<'date' | 'week'> = ref('week')
  /** 在type为date下渲染的日期，（00:00:00）*/
  readonly renderDate: Ref<Date> = ref(now())
  /** 在type为week下渲染的周的周天，（00:00:00） */
  readonly renderWeek: Ref<Date> = ref(getSundayOfTheWeek(new Date()))
  /** 当前显示的日期，（00:00:00） */
  readonly currentDate: ComputedRef<Date> = computed(() => {
    if (this.type.value === 'date') {
      return this.renderDate.value
    } else {
      return this.renderWeek.value
    }
  })
  /** 给controller日期选择器的value */
  readonly controllerValue: WritableComputedRef<Date, Date> = computed({
    get: () => {
      if (this.type.value === 'date') {
        return this.renderDate.value
      } else {
        return this.renderWeek.value
      }
    },
    set: (value: Date) => {
      if (this.type.value === 'date') {
        this.renderDate.value = value
      } else {
        this.renderWeek.value = value
      }
    }
  })
  /** 给renderer渲染的日期数据 date*/
  readonly rendererDate: ComputedRef<Date> = computed(() => {
    return this.renderDate.value
  })
  /** 给renderer渲染的日期数据 week*/
  readonly rendererWeek: ComputedRef<Date[]> = computed(() => {
    const sunday = this.renderWeek.value
    const res = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday.getTime())
      day.setDate(day.getDate() + i)
      res.push(day)
    }
    return res
  })
  /** 给renderer渲染的日期数据 全部 */
  readonly rendererDates: ComputedRef<Date[]> = computed(() => {
    if (this.type.value === 'date') {
      return [this.rendererDate.value]
    } else {
      return this.rendererWeek.value
    }
  })

  /** 管理器类型改变监视器 */
  private __typeWatcher: WatchHandle
  /** 管理器天模式日期改变监视器 */
  private __dateWatcher: WatchHandle
  /** 管理器周模式日期改变监视器 */
  private __weekWatcher: WatchHandle

  constructor(calendar: LoongCalendarManager) {
    super(calendar)

    this.__loong.on('frame-update', this.frameUpdate, this)
    this.__loong.on('clear', this.clear, this)
    this.__typeWatcher = watch(this.type, () => {
      /** 重新构建堆顶元素 */
      this.__readyToAddSchedules.rebuild()
      this.__readyToRemoveSchedules.rebuild()
      this.__readyToCalSizeDate.rebuild()
      this.__loong.emit('render-type-change', this.type.value)
    })
    this.__dateWatcher = watch(this.renderDate, (newVal: Date, oldVal: Date) => {
      /** 重新构建堆顶元素 */
      this.__readyToAddSchedules.rebuild()
      this.__readyToRemoveSchedules.rebuild()
      this.__readyToCalSizeDate.rebuild()
      this.__loong.emit('render-data-update')
      this.__loong.emit('render-time-range-change', 'date', newVal, oldVal)
      /** 日期修改，将需要计算的尺寸的 */
      /** 日期修改，将需要计算的尺寸的 */
      this.rendererDates.value.forEach((date) => {
        this.__readyToCalSizeDate.insert(date.toLocaleDateString())
      })
    })
    this.__weekWatcher = watch(this.renderWeek, (newVal: Date, oldVal: Date) => {
      /** 重新构建堆顶元素 */
      this.__readyToAddSchedules.rebuild()
      this.__readyToRemoveSchedules.rebuild()
      this.__readyToCalSizeDate.rebuild()
      this.__loong.emit('render-data-update')
      this.__loong.emit('render-time-range-change', 'week', newVal, oldVal)
      /** 日期修改，将需要计算的尺寸的 */
      this.rendererDates.value.forEach((date) => {
        this.__readyToCalSizeDate.insert(date.toLocaleDateString())
      })
    })
  }

  /**
   * 增加日程，此方法在日程实例初始化的时候调用
   * #### Notes
   * - *并不会马上增加日程，会尝试在下一个帧更新时增加，但是每次只会增加前20个日程*
   * - *增加也不会马上绘制，会尝试在增加后的帧更新时计算增加后其余元素的大小，存储数据*
   * - *在之后的帧更新时，会尝试将数据绘制到画布上*
   * @param schedule schedule
   * @param scheduleData scheduleData
   * @returns this
   */
  addSchedule(schedule: LoongSchedule, scheduleData: LoongCalendarManagerScheduleData): boolean {
    if (this.__schedulesStatus.has(schedule.id)) {
      console.warn(`[LoongCalendar] schedule ${schedule.id} is already added`)
      return false
    }
    this.__schedulesStatus.set(schedule.id, LoongCalendarScheduleInManagerStatus.ADDING)
    const status = this.__schedulesStatus.get(schedule.id) as LoongCalendarScheduleInManagerStatus
    if (status !== LoongCalendarScheduleInManagerStatus.ADDING) {
      console.warn(`addSchedule [LoongCalendar] schedule ${schedule.id}'s status is ${status}`)
      return false
    }
    this.__readyToAddSchedules.insert([schedule, scheduleData])
    return true
  }

  /**
   * 移除日程，此方法在日程实例被调用remove时调用
   * #### Notes
   * - *并不会马上移除日程，会尝试在下一个帧更新时移除，但是每次只会移除前10个日程*
   * - *移除也不会马上绘制，会尝试在移除后的帧更新时计算移除后其余元素的大小，存储数据*
   * - *在之后的帧更新时，会尝试将数据绘制到画布上*
   * @param schedule schedule
   * @param scheduleData scheduleData
   * @returns this
   */
  removeSchedule(schedule: LoongSchedule, scheduleData: LoongCalendarManagerScheduleData): this {
    if (
      !this.__schedulesStatus.has(schedule.id) ||
      this.__schedulesStatus.get(schedule.id) === LoongCalendarScheduleInManagerStatus.REMOVING ||
      this.__schedulesStatus.get(schedule.id) === LoongCalendarScheduleInManagerStatus.ADDING
    ) {
      console.warn(`removeSchedule [LoongCalendar] schedule ${schedule.id}'s status is ${this.__schedulesStatus.get(schedule.id)}`)
      return this
    }
    this.__schedulesStatus.set(schedule.id, LoongCalendarScheduleInManagerStatus.REMOVING)
    this.__readyToRemoveSchedules.insert([schedule, scheduleData])
    return this
  }

  /**
   * 获取日程渲染数据
   * @param date 日期
   * @returns 有更新时返回数据，数据不存在返回undefined，数据没更新返回null
   */
  getScheduleRenderData(date: Date): ScheduleRenderData[] | undefined | null {
    const check = this.__renderDataUpdateMap.get(date.toLocaleDateString())
    if (check === undefined) return check
    if (check) {
      this.__renderDataUpdateMap.set(date.toLocaleDateString(), false)
      return this.__renderDataMap.get(date.toLocaleDateString())
    } else return null
  }

  protected clear() {
    this.type.value = 'week'
    this.renderDate.value = now()
    this.renderWeek.value = getSundayOfTheWeek(new Date())
    this.__renderDataMap.clear()
    this.__loong.emit('render-data-update')
  }

  protected destroy(): void {
    this.__renderDataMap.clear()
    this.__typeWatcher.stop()
    this.__dateWatcher.stop()
    this.__weekWatcher.stop()
  }

  /**
   * 帧更新，检查待排序日程
   */
  private frameUpdate() {
    const addSize = 20
    const removeSize = 10
    const calSize = 10
    let dataUpdate = false
    /** 检查需要add的日程 */
    if (this.__readyToAddSchedules.size() > 0) {
      for (let i = 0; i < addSize; i++) {
        const t = this.__readyToAddSchedules.extractTop()
        if (t) {
          this.__scheduleDatabase.addSchedule(t[0], t[1])
          /** 修改schedule状态 */
          this.__schedulesStatus.set(t[0].id, LoongCalendarScheduleInManagerStatus.ADDED)
          dataUpdate = true
        } else {
          break
        }
      }
    }
    /** 检查需要remove的日程 */
    if (this.__readyToRemoveSchedules.size() > 0) {
      for (let i = 0; i < removeSize; i++) {
        const t = this.__readyToRemoveSchedules.extractTop()
        if (t) {
          this.__scheduleDatabase.removeSchedule(t[0], t[1])
          /** 移除schedule状态 */
          this.__schedulesStatus.delete(t[0].id)
          dataUpdate = true
        } else {
          break
        }
      }
    }
    /** 如果数据变化，将当前渲染的日期数据进行重新计算 */
    if (dataUpdate) {
      this.rendererDates.value.forEach((date) => {
        this.__readyToCalSizeDate.insert(date.toLocaleDateString())
      })
    }
    /** 检查需要cal的日期 */
    if (this.__readyToCalSizeDate.size() > 0) {
      for (let i = 0; i < calSize; i++) {
        const t = this.__readyToCalSizeDate.extractTop()
        if (t) {
          this.calculateRenderData(t)
        } else {
          break
        }
      }
    }
  }

  /**
   * 计算渲染尺寸
   * @param key 日期
   */
  private calculateRenderData(key: string) {
    const date = new Date(key)
    /** 已经按照起始时刻排好序 */
    const timeRangeList = this.__scheduleDatabase.searchTimeRange(date)
    if (timeRangeList === undefined) return
    type MeetingColumeData = ScheduleRenderData[] // 最晚结束的排在最前
    type MeetingGroupData = MeetingColumeData[]
    type FullMeetingData = MeetingGroupData[]
    const meetings: FullMeetingData = [[[]]]
    let colAmount = 1
    timeRangeList.forEach((timeRange) => {
      const renderData = new ScheduleRenderData(timeRange.schedule, timeRange)
      const lastMeetingGroup = meetings[meetings.length - 1]
      const length = lastMeetingGroup.length
      // 因为colume是最晚结束的排在最前，所以此时排完group的顺序就是结束时间从早到晚
      lastMeetingGroup.sort((a, b) => a[0].endTimestamp - b[0].endTimestamp)
      // 此时的renderData是否还是在lastGroup中
      let inside = false
      // 最大结束时间大于当前开始时间，有时间重叠
      if (
        length > 0 &&
        lastMeetingGroup[length - 1].length > 0 &&
        lastMeetingGroup[length - 1][0].endTimestamp > renderData.startTimestamp
      ) {
        inside = true
      }
      if (inside) {
        // 是否需要新的一列（不可以直接插入）
        let needANewColume = false
        // 最小结束时间大于当前开始时间，无法直接插入，需要新增一列
        if (lastMeetingGroup[0][0].endTimestamp > renderData.startTimestamp) needANewColume = true
        if (needANewColume) {
          // 列数加一
          colAmount++
          renderData.colIndex = colAmount
          renderData.colAmount = colAmount
          // 为本组全部成员重新设置列数
          lastMeetingGroup.forEach((g) => {
            g.forEach((m) => {
              m.colAmount = colAmount
            })
          })
          // 向本组增加一列
          lastMeetingGroup.push([renderData])
        } else {
          renderData.colAmount = colAmount
          renderData.colIndex = lastMeetingGroup[0][0].colIndex // 这两者是同一列的
          lastMeetingGroup[0].unshift(renderData) // 插入最先结束的组
        }
      } else {
        // 如果group为空，则push
        if (length === 0) lastMeetingGroup[0].push(renderData)
        else {
          // 创建新的group
          colAmount = 1
          const newFroup: MeetingGroupData = [[renderData]]
          meetings.push(newFroup)
        }
      }
    })
    // 现在所有的数据都已经安排好位置
    // 检查每一条数据的宽度
    // 先检查数据左侧是否有空间
    // 然后检查数据右侧是否有空间
    meetings.forEach((group) => {
      // 对组里面的列排序
      group.sort((a, b) => a[0].colIndex - b[0].colIndex)
      // 本轮检查左侧
      group.forEach((column, ci) => {
        column.forEach((renderData) => {
          if (!renderData.draw) return
          const startTimestamp = renderData.startTimestamp
          const endTimestamp = renderData.endTimestamp
          const renderDataColAmount = renderData.colAmount
          let nowColumeIndex = ci
          while (
            nowColumeIndex > 0 &&
            group[nowColumeIndex - 1].findIndex((rd) => {
              if (rd.startTimestamp <= startTimestamp && rd.endTimestamp > startTimestamp) {
                return true
              } else if (rd.endTimestamp >= endTimestamp && rd.startTimestamp < endTimestamp) {
                return true
              } else if (rd.startTimestamp >= startTimestamp && rd.endTimestamp <= endTimestamp) {
                return true
              }
              return false
            }) === -1
          ) {
            nowColumeIndex--
          }
          // 塞入占位数据
          for (let i = nowColumeIndex; i < ci; i++) {
            group[i].push(new ScheduleRenderData(renderData.schedule, renderData.timeRange, false))
          }
          // 更新数据
          // 左侧如果有空间，可以向左扩张
          renderData.left = nowColumeIndex / renderDataColAmount // 实际用的
          // renderData.left = ci / renderDataColAmount // 不进行计算的
          // 宽度也对应变化，具体width在计算右侧空间时再算
          renderData.hasColAmount = ci - nowColumeIndex + 1 // 实际用的
          // renderData.hasColAmount = 1 // 不进行计算的
        })
      })
      // 本轮检查右侧
      group.forEach((column, ci) => {
        const columeAmount = group.length
        column.forEach((renderData) => {
          if (!renderData.draw) return
          const startTimestamp = renderData.startTimestamp
          const endTimestamp = renderData.endTimestamp
          let nowColumeIndex = ci
          while (
            nowColumeIndex < columeAmount - 1 &&
            group[nowColumeIndex + 1].findIndex((rd) => {
              if (rd.startTimestamp <= startTimestamp && rd.endTimestamp > startTimestamp) {
                return true
              } else if (rd.endTimestamp >= endTimestamp && rd.startTimestamp < endTimestamp) {
                return true
              } else if (rd.startTimestamp >= startTimestamp && rd.endTimestamp <= endTimestamp) {
                return true
              }
              return false
            }) === -1
          ) {
            nowColumeIndex++
          }
          // 塞入占位数据
          for (let i = ci + 1; i <= nowColumeIndex; i++) {
            group[i].push(new ScheduleRenderData(renderData.schedule, renderData.timeRange, false))
          }
          // 更新数据
          // 宽度也对应变化，具体width在计算右侧空间时再算
          renderData.hasColAmount = nowColumeIndex - ci + renderData.hasColAmount // 实际用的
          // renderData.hasColAmount = renderData.hasColAmount // 不进行计算的
          renderData.width = renderData.hasColAmount / renderData.colAmount // 实际用的
        })
      })
    })
    // 将所有数据展平
    const allRenderData = meetings.flat(2)
    // 过滤掉draw不为true的
    const useRenderData = allRenderData.filter((rd) => rd.draw)
    this.__renderDataMap.set(date.toLocaleDateString(), useRenderData)
    /** 设置该日期日程数据有更新 */
    this.__renderDataUpdateMap.set(date.toLocaleDateString(), true)
  }
}
