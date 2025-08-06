import type { Madison } from '@/core/madison/core'
import { FaultManager } from '.'
import { MadisonAddon } from '@/core/madison/core/addon-base'
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { RouterPromiseSyncFuncRes } from '@/core/madison/types'
import type { GetInjectionResForManager, GetInjectionResItem, GetInjectionResItemHistory } from '../types'
import { getDatesForNextSevenDays, MadisonItemMap, MadisonMapItem, parseTimeToSeconds } from '@/core/madison/utils'
import { computed, reactive, ref, type ComputedRef, type Reactive, type Ref, type WritableComputedRef } from 'vue'
import { getFutureInjection, getHistoryInjection, getInjectionResult } from './api'
import { getSundayOfTheWeek, LoongCalendarManager, LoongSchedule, now, ScheduleRenderData, useCalendar } from '@/components/LoongCalendar'

export class FaultItem {
  readonly id: string
  readonly renderId: string
  readonly schedule: LoongSchedule
  private __calendar: LoongCalendarManager
  constructor(data: GetInjectionResForManager, calendar: LoongCalendarManager) {
    this.id = data.id
    this.renderId = data.id + '-' + Math.floor(Math.random() * 1000000000000).toString()
    this.schedule = new LoongSchedule(
      calendar,
      this.renderId,
      data.name,
      '',
      data.category,
      new Date(data.timestamp * 1000),
      new Date(data.timestamp * 1000 + data.duration * 1000),
      data
    )
    this.__calendar = calendar
  }

  addToCalendar() {
    this.schedule.display()
  }

  removeFromCalendar() {
    this.schedule.hide()
  }

  destroy() {
    this.schedule.destroy()
  }
}

export class OnedayFaults extends MadisonMapItem<string> {
  readonly date: Date
  readonly dateStr: string
  private __faults: Map<string, FaultItem> = new Map()
  private __calendar: LoongCalendarManager

  constructor(date: Date, calendar: LoongCalendarManager) {
    super()
    this.date = date
    this.dateStr = date.toISOString().substring(0, 10)
    this.__calendar = calendar
  }

  addFaults(faults: GetInjectionResForManager[]) {
    const keysSet = new Set(this.__faults.keys())
    faults.forEach(data => {
      if (this.__faults.has(data.id)) {
        // 删除旧的fault
        this.__faults.get(data.id)?.destroy()
      }
      keysSet.delete(data.id)
      this.__faults.set(data.id, new FaultItem(data, this.__calendar))
    })
    keysSet.forEach(key => this.__faults.get(key)?.destroy())
  }

  display() {
    this.__faults.forEach(fault => fault.addToCalendar())
  }

  hide() {
    this.__faults.forEach(fault => fault.removeFromCalendar())
  }

  rGet(key: string): void {}

  rSet(key: string): void {}

  rDelete(key: string): void {
    const values = Array.from(this.__faults.values())
    values.forEach(fault => fault.destroy())
  }
}

class OnedayFaultsMap extends MadisonItemMap<string, OnedayFaults> {
  rGet(key: string): void {

  }

  rSet(key: string): void {}

  rDelete(key: string): void {
    const keys = Array.from(this.keys())
    keys.forEach(key => this.delete(key))
  }

  display() {
    const values = this.values()
    values.forEach(onedayFaults => onedayFaults.display())
  }

  hide() {
    const values = this.values()
    values.forEach(onedayFaults => onedayFaults.hide())
  }
}

export class CalendarFaultsRenderManager extends MadisonAddon {
  static readonly CAL_DEF_NAMESPACE = 'no-selected'

  private __calendar: LoongCalendarManager
  private __faultManager: FaultManager
  private __namespace: Ref<string> = ref(CalendarFaultsRenderManager.CAL_DEF_NAMESPACE)

  private __datesToWaitForLoading: Reactive<Map<string, Set<string>>> = reactive(new Map())
  private __datesToWaitForLoadingError: Reactive<Map<string, Set<string>>> = reactive(new Map())

  readonly namespace:ComputedRef<string> = computed(() => {
    return this.__namespace.value
  })

  readonly renderDataLoaded: ComputedRef<boolean> = computed(() => {
    const namespace = this.__namespace.value
    if (namespace ===  CalendarFaultsRenderManager.CAL_DEF_NAMESPACE) return false
    const datesSet = this.__datesToWaitForLoading.get(namespace) || new Set()
    if (this.__calendar.manager.type.value === 'week') {
      const dates = getDatesForNextSevenDays(this.__calendar.manager.renderWeek.value)
      return dates.every(date => !datesSet.has(date.toLocaleDateString()))
    } else {
      return !datesSet.has(this.__calendar.manager.renderDate.value.toLocaleDateString())
    }
  })

  readonly currentRenderDataLoaded: ComputedRef<boolean> = computed(() => {
    const namespace = this.__namespace.value
    if (namespace ===  CalendarFaultsRenderManager.CAL_DEF_NAMESPACE) return false
    const datesSet = this.__datesToWaitForLoading.get(namespace) || new Set()
    return datesSet.size === 0
  })

  readonly datesToWaitForLoading: ComputedRef<string> = computed(() => {
    const namespace = this.__namespace.value
    if (namespace ===  CalendarFaultsRenderManager.CAL_DEF_NAMESPACE) return ''
    const datesSet = this.__datesToWaitForLoading.get(namespace) || new Set()
    return Array.from(datesSet).sort((a, b) => new Date(a) < new Date(b) ? -1 : 1).join(',')
  })

  readonly datesToWaitForLoadingError: ComputedRef<string> = computed(() => {
    const namespace = this.__namespace.value
    if (namespace ===  CalendarFaultsRenderManager.CAL_DEF_NAMESPACE) return ''
    const datesSet = this.__datesToWaitForLoadingError.get(namespace) || new Set()
    return Array.from(datesSet).sort((a, b) => new Date(a) < new Date(b) ? -1 : 1).join(',')
  })

  // Map<namespace, OnedayFaultsMap>
  private __data: Map<string, OnedayFaultsMap> = new Map()

  constructor(madison: Madison, calendar: LoongCalendarManager, faultManager: FaultManager) {
    super(madison)

    this.__calendar = calendar
    this.__faultManager = faultManager
  }

  has(namespace: string, date: string): boolean {
    return this.__data.has(namespace) && (this.__data.get(namespace) as OnedayFaultsMap).has(date)
  }

  dates(namespace: string) {
    const onedayFaultsMap = this.__data.get(namespace)
    return onedayFaultsMap ? Array.from(onedayFaultsMap.keys()) : []
  }

  displayNamespace(namespace: string) {
    if (namespace === this.__namespace.value) return
    const newOFM = this.__data.get(namespace)
    const oldOFM = this.__data.get(this.__namespace.value)
    if (oldOFM) oldOFM.hide()
    if (newOFM) newOFM.display()
    this.__namespace.value = namespace
  }

  private startPoller(taskIds: string[], namespace: string, date: string, prevRes: GetInjectionResForManager[], interval: number = 400) {
    setTimeout(async () => {
      const res = await Promise.allSettled(taskIds.map(taskId => getInjectionResult({ taskId })))
      const taskIdSet = new Set(taskIds)
      const nextRes = [...prevRes]
      res.forEach((res, i) => {
        if (res.status !== 'fulfilled') return
        const data = res.value.data
        const errSet = this.__datesToWaitForLoadingError.get(namespace) as Set<string>
        const set = this.__datesToWaitForLoading.get(namespace) as Set<string>
        if (data.code === 0) {
          if (data.data.status === 'SUCCESS') {
            const list: GetInjectionResItem[] | GetInjectionResItemHistory[] = Object.values(data.data.result)
            const addList: GetInjectionResForManager[] = list.map((item) => {
              const temp = item as any
              const category = this.__faultManager.getFaultCategory(temp.spec.kind as string) || 'Unknown'
              const type = this.__faultManager.getFaultType(temp.spec.kind as string) || 'Unknown'
              if (temp.id) {
                const t = temp as GetInjectionResItem
                return {
                  id: t.id,
                  name: t.name,
                  timestamp: t.timestamp,
                  duration: parseTimeToSeconds(t.spec.duration),
                  kind: t.kind,
                  category,
                  type,
                  meta: t
                }
              } else {
                const t = temp as GetInjectionResItemHistory
                return {
                  id: t.id,
                  name: t.name,
                  timestamp: t.timestamp,
                  duration: parseTimeToSeconds(t.spec.duration),
                  kind: t.kind,
                  category,
                  type,
                  meta: t
                }
              }
            })
            nextRes.push(...addList)
            set.delete(date)
            taskIdSet.delete(taskIds[i])
          } else if (data.data.status === 'FAILURE') {
            errSet.add(date)
            taskIdSet.delete(taskIds[i])
          }
        } else {
          errSet.add(date)
          taskIdSet.delete(taskIds[i])
        }
      })
      if (taskIdSet.size === 0) {
        // add task 的时候已经将其添加
        const ofm = this.__data.get(namespace) as OnedayFaultsMap
        // add task 的时候已经将其添加
        const of = ofm.get(date) as OnedayFaults
        of.addFaults(nextRes)
      } else {
        this.startPoller([...taskIdSet], namespace, date, nextRes, interval)
      }
    }, interval)
  }

  addTask(namespace: string, date: string, taskId: string | string[]) {
    if (!this.__data.has(namespace)) this.__data.set(namespace, new OnedayFaultsMap())
    const ofm = this.__data.get(namespace) as OnedayFaultsMap
    if (!ofm.has(date)) ofm.set(date, new OnedayFaults(new Date(date), this.__calendar))
    if (!this.__datesToWaitForLoadingError.has(namespace)) this.__datesToWaitForLoadingError.set(namespace, new Set())
    if (!this.__datesToWaitForLoading.has(namespace)) this.__datesToWaitForLoading.set(namespace, new Set())
    const set = this.__datesToWaitForLoading.get(namespace) as Set<string>
    set.add(date)
    this.startPoller(Array.isArray(taskId) ? taskId : [taskId], namespace, date, [])
  }

  logoutCallback(): void {

  }
}

/**
 * precheck: 检查需要获取哪些数据，检查是什么namespace
 * check: 询问CalendarFaultsRenderManager数据是否需要获取，lastCurrent和current不进行询问
 * postcheck: 将需要显示的数据传给CalendarFaultsRenderManager
 */
export class CalendarFaultsManager extends MadisonAddon {
  static readonly CAL_KEY = 'FalurHistoryCalendar'
  readonly faultManager: FaultManager
  private __calendar: LoongCalendarManager
  private __renderType: 'week' | 'date'
  private __renderDay: Date
  private __renderWeek: Date

  private __current: Date = new Date()

  readonly namespacesRoute: ComputedRef<[string, boolean, RouteLocationRaw][]> = computed(() => {
    const namespaces = this.__madison.namespace.namespaces.value
    return namespaces.map((namespace) => {
      return [
        namespace,
        this.__manager.namespace.value === namespace,
        {
          name: 'faultinjection',
          query: {
            namespace,
            type: 'week',
            date: this.__renderWeek.toLocaleDateString()
          }
        }
      ]
    })
  })

  readonly namespacesSelected: WritableComputedRef<string, string> = computed({
    get: () => this.__manager.namespace.value,
    set: (value) => {
      let route = this.namespacesRoute.value.find((item) => item[0] === value)
      if (!route) route = this.namespacesRoute.value[0]
      this.__madison.routerPromise.router.push(route[2])
    }
  })

  readonly namespacesSelectedOptions: ComputedRef<{ label: string, value: string }[]> = computed(() => {
    return this.namespacesRoute.value.map((item) => {
      return {
        label: item[0],
        value: item[0]
      }
    })
  })

  private __manager: CalendarFaultsRenderManager

  readonly renderDataLoaded: ComputedRef<boolean> = computed(() => this.__manager.renderDataLoaded.value)
  readonly currentRenderDataLoaded: ComputedRef<boolean> = computed(() => this.__manager.currentRenderDataLoaded.value)
  readonly datesToWaitForLoading: ComputedRef<string> = computed(() => this.__manager.datesToWaitForLoading.value)
  readonly datesToWaitForLoadingError: ComputedRef<string> = computed(() => this.__manager.datesToWaitForLoadingError.value)
  readonly namespaceIsValid: ComputedRef<boolean> = computed(() => {
    return this.__manager.namespace.value !== CalendarFaultsRenderManager.CAL_DEF_NAMESPACE && this.__madison.namespace.queryNamespaceIsValidRef.value
  })

  private __cardVisible: Ref<boolean> = ref(false)
  private __left: Ref<number> = ref(0)
  private __top: Ref<number> = ref(0)
  private __clientX: Ref<number> = ref(0)
  private __clientY: Ref<number> = ref(0)
  private __schedule: ScheduleRenderData | null = null
  private __scheduleRenderData: Reactive<{
    id?: string
    title?: string
    category?: string
    content?: string
    startTime?: Date
    endTime?: Date
    type?: string
  }> = reactive({})

  get cardVisible() {
    return computed(() => this.__cardVisible.value)
  }

  get cardLeft() {
    return computed(() => this.__left.value)
  }

  get mouseClientX() {
    return computed(() => this.__clientX.value)
  }

  get mouseClientY() {
    return computed(() => this.__clientY.value)
  }

  get cardTop() {
    return computed(() => this.__top.value)
  }

  get cardSchedule() {
    return computed(() => this.__scheduleRenderData)
  }

  constructor(madiosn: Madison, faultManager: FaultManager) {
    super(madiosn)
    this.faultManager = faultManager
    this.__calendar = useCalendar(CalendarFaultsManager.CAL_KEY)
    this.__calendar.on('render-type-change', this.renderTypeChange, this)
    this.__calendar.on('render-time-range-change', this.renderTimeRangeChange, this)

    this.__renderType = this.__calendar.manager.type.value
    this.__renderDay = this.__calendar.manager.renderDate.value
    this.__renderWeek = this.__calendar.manager.renderWeek.value

    madiosn.routerPromise.addPrecheck(this.precheck, this)
    madiosn.routerPromise.addCheck(this.check, this)
    madiosn.routerPromise.addPostcheck(this.postcheck, this)

    this.__manager = new CalendarFaultsRenderManager(madiosn, this.__calendar, faultManager)

    // this.__calendar.on('canvas-online', this.canvasOnLine, this)
    // this.__calendar.on('canvas-offline', this.canvasOffline, this)
    this.__calendar.on('schedule-mouse-in', this.renderDataIn, this)
    this.__calendar.on('schedule-mouse-out', this.renderDataOut, this)
    this.__calendar.on('schedule-mouse-move', this.renderMouseMove, this)
  }

  private renderDataIn(schedule: ScheduleRenderData) {
    this.__cardVisible.value = true
    this.__schedule = schedule
    this.__scheduleRenderData.id = schedule.schedule.id
    this.__scheduleRenderData.category = schedule.schedule.category as string
    this.__scheduleRenderData.content = schedule.schedule.content
    this.__scheduleRenderData.title = schedule.schedule.title
    this.__scheduleRenderData.startTime = schedule.timeRange.startTime
    this.__scheduleRenderData.endTime = schedule.timeRange.endTime
    this.__scheduleRenderData.type = schedule.schedule.meta.type
  }

  private renderDataOut(schedule: ScheduleRenderData) {
    this.__cardVisible.value = false
    this.__schedule = null
  }

  private renderMouseMove(event: MouseEvent, schedule: ScheduleRenderData) {
    this.__cardVisible.value = true
    this.__left.value = event.offsetX
    this.__top.value = event.offsetY
    this.__clientX.value = event.clientX
    this.__clientY.value = event.clientY
    if (this.__scheduleRenderData.id === schedule.schedule.id) return
    this.__scheduleRenderData.category = schedule.schedule.category as string
    this.__scheduleRenderData.content = schedule.schedule.content
    this.__scheduleRenderData.title = schedule.schedule.title
    this.__scheduleRenderData.startTime = schedule.timeRange.startTime
    this.__scheduleRenderData.endTime = schedule.timeRange.startTime
    this.__scheduleRenderData.type = schedule.schedule.meta.type
  }

  private renderTypeChange(type: 'week' | 'date') {
    this.__madison.routerPromise.router.push({
      name: 'faultinjection',
      query: {
        namespace: this.__manager.namespace.value,
        type,
        date: type === 'date' ? this.__renderDay.toLocaleDateString() : this.__renderWeek.toLocaleDateString()
      }
    })
  }

  private renderTimeRangeChange(type: 'week' | 'date', newVal: Date, oldVal: Date) {
    if (newVal.getTime() === oldVal.getTime()) return
    this.__madison.routerPromise.router.push({
      name: 'faultinjection',
      query: {
        namespace: this.__manager.namespace.value,
        type,
        date: newVal.toLocaleDateString()
      }
    })
  }

  logoutCallback(): void {
    this.__calendar.clear()
    this.__renderType = this.__calendar.manager.type.value
    this.__renderDay = this.__calendar.manager.renderDate.value
    this.__renderWeek = this.__calendar.manager.renderWeek.value
  }

  private getNeedDateDates(): Date[] {
    if (this.__renderType === 'date') return [this.__renderDay]
    else {
      return getDatesForNextSevenDays(this.__renderWeek)
    }
  }

  refresh(): void
  refresh(date: Date): void
  refresh(force: true): void
  refresh(param1?: Date | true): void {
    this.query(this.__manager.namespace.value, param1)
  }

  // private async query(namespace: string): Promise<void>
  // private async query(namespace: string, date: Date): Promise<void>
  // private async query(namespace: string, force: true): Promise<void>
  private async query(namespace: string, param1?: Date | true): Promise<void> {
    let forceQuery = false
    const getDates = (param1?: Date | true) => {
      if (param1 === true) {
        forceQuery = true
        return this.__manager.dates(namespace).map((date) => new Date(date))
      } else if (param1 instanceof Date) {
        forceQuery = true
        return [new Date(param1)]
      } else {
        return this.getNeedDateDates()
      }
    }
    const dates = getDates(param1)
    // 上次查询的时刻
    // 因为每次查询需要更新当前时刻那天和上次查询那天的数据
    // history - current - future
    // 调用不同的接口
    const lastCurrent = this.__current
    const current = new Date()
    const lastCurrentDateStr = lastCurrent.toLocaleDateString()
    const currentDateStr = current.toLocaleDateString()
    const promiseList: Promise<[string, string, boolean]>[] = []
    dates.forEach((date) => {
      const dateStr = date.toLocaleDateString()
      if (dateStr !== currentDateStr) {
        // 已经获取且不是上次分割查询的数据
        // 对于分割查询的数据每次重新查询需要更新
        if (!forceQuery && this.__manager.has(namespace, dateStr) && dateStr !== lastCurrentDateStr) return
        const td = new Date(current)
        td.setHours(0, 0, 0, 0)
        if (date < td) {
          // history
          promiseList.push(this.createPromise('H', dateStr, namespace, date))
        } else {
          // future
          promiseList.push(this.createPromise('F', dateStr, namespace, date))
        }
      } else {
        const startTimeH = date.getTime()
        const endTimeH = current.getTime()
        const startTimeF = current.getTime()
        const endTimeF = date.getTime() + 24 * 60 * 60 * 1000
        promiseList.push(this.createPromise('H', dateStr, namespace, startTimeH, endTimeH))
        promiseList.push(this.createPromise('F', dateStr, namespace, startTimeF, endTimeF))
      }
    })
    this.__current = current
    const res = await Promise.allSettled(promiseList)
    const todayRes: [string, string, string][] = []
    res.forEach((item) => {
      const status = item.status
      if (status !== 'fulfilled') return
      const value = item.value
      /** taskId不存在 */
      if (value[0] === '') return
      if (value[2]) {
        todayRes.push([namespace, value[1], value[0]])
        return
      }
      if (forceQuery || !this.__manager.has(namespace, value[1])) this.__manager.addTask(namespace, value[1], value[0])
    })
    if (todayRes.length > 0) {
      const taskIds = todayRes.map(v => v[2])
      this.__manager.addTask(namespace, todayRes[0][1], taskIds)
    }
  }

  private precheck(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ): RouterPromiseSyncFuncRes {
    if (to.name !== 'faultinjection') return
    const ttype = to.query.type
    if (ttype !== 'week' && ttype !== 'date') {
      return ['redirect', { name: 'faultinjection', query: { ...to.query, type: this.__renderType }}]
    }
    const type = ttype as 'week' | 'date'
    this.__renderType = type
    const tdateString = to.query.date
    // 不存在则认为的今天或这周
    const dateString = tdateString ? tdateString as string : (type === 'week' ? getSundayOfTheWeek(new Date()).toLocaleDateString() : now().toLocaleDateString())
    const tdate = new Date(dateString)
    const ttime = tdate.getTime()
    if (isNaN(ttime)) {
      // 错误的时间格式
      return ['redirect', { name: 'faultinjection', query: { ...to.query, type, date: null }}]
    }
    const date = new Date(ttime)
    if (type === 'week') {
      this.__renderWeek = date
    } else {
      this.__renderDay = date
    }
    if (this.__manager.namespace.value !== CalendarFaultsRenderManager.CAL_DEF_NAMESPACE && to.query.namespace !== this.__manager.namespace.value) {
      return  ['redirect', { name: 'faultinjection', query: { ...to.query, namespace: this.__manager.namespace.value }}]
    }
  }

  private createPromise(type: 'H' | 'F', date: string, namespace: string, param1: number, param2: number): Promise<[string, string, boolean]>
  private createPromise(type: 'H' | 'F', date: string, namespace: string, param1: Date): Promise<[string, string, boolean]>
  private createPromise(type: 'H' | 'F', date: string, namespace: string, param1: number | Date, param2?: number): Promise<[string, string, boolean]> {
    return (async () => {
      const startTime = typeof param1 === 'number' ? param1 : param1.getTime()
      const endTime = typeof param2 === 'number' ? param2 : (new Date(param1)).getTime() + 24 * 60 * 60 * 1000
      const res = type === 'H' ? await getHistoryInjection({
        startTime:Math.floor(startTime / 1000),
        endTime: Math.floor(endTime / 1000) - 1,
        namespace
      }) : await getFutureInjection({
        startTime:Math.floor(startTime / 1000),
        endTime: Math.floor(endTime / 1000) - 1,
        namespace
      })
      const data = res.data
      const today = new Date()
      if (data.code === 0) {
        return [data.data.task_id, date, date === today.toLocaleDateString()]
      } else {
        return ['', date, date === today.toLocaleDateString()]
      }
    })()
  }

  private async check(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ): Promise<RouteLocationRaw | void> {
    const can = await this.defQNSCheck(
      to,
      from,
      'faultinjection'
    )
    if (!can) return
    const namespace = to.query.namespace as string
    this.query(namespace)
  }

  private postcheck(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ): RouterPromiseSyncFuncRes {
    if (to.name !== 'faultinjection') return
    if (this.__madison.namespace.queryNamespaceIsValid) {
      this.__manager.displayNamespace(this.__madison.namespace.queryNamespace.value)
    }
    this.__calendar.manager.type.value = this.__renderType
    if (this.__renderType === 'date') {
      this.__calendar.manager.renderDate.value = this.__renderDay
    } else {
      this.__calendar.manager.renderWeek.value = this.__renderWeek
    }
  }
}
