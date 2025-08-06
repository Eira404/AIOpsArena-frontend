import type { LoongCalendaerRendererOptions } from '../../types'
import type { LoongCalendarManager } from '../../'
import { LRUCache, throttle } from '../utils'
import { LoongAddon } from './loong-addon'
import type { ScheduleRenderData } from './loong-addon-manager'
import { DayRenderer } from './renderers/day-renderer'
import { GridLineRenderer } from './renderers/grid-line-renderer'
import { NowTimeRenderer } from './renderers/now-time-renderer'
import { ScheduleRenderer } from './renderers/schedule-renderer'
import { ScrollbarRenderer } from './renderers/scrollbar-renderer'
import { TimeRenderer } from './renderers/time-renderer'

export class Renderer extends LoongAddon {
  private __canvas: HTMLCanvasElement | null = null
  private __ctx: CanvasRenderingContext2D | null = null

  get ctx() {
    return this.__ctx
  }

  get canvas() {
    return this.__canvas
  }

  private __mouseIsDown = false
  private __mouseIsIn = false
  private __reversalXInput = false
  private __reversalYInput = false

  /** 强制变换scale offset */
  private __fouse = false

  xScale = 1
  yScale = 1
  lastXScale = 1
  lastYScale = 1
  xStep = 0.2 // 放大或缩小的步长
  yStep = 0.2 // 放大或缩小的步长

  private __scrollOffset = 40

  canvasWidth = 0
  canvasHeight = 0
  currentMouseX = 0
  currentMouseY = 0
  mouseX = 0 // 鼠标的x坐标（相对于canvas）
  mouseY = 0 // 鼠标的y坐标（相对于canvas）

  xOffset = 0 // 日历x轴偏移
  yOffset = 0 // 日历y轴偏移

  calendarLT: [number, number] = [0, 0] // 日历左上角顶点坐标
  calendarRB: [number, number] = [0, 0] // 日历右下角顶点坐标
  timeLT: [number, number] = [0, 0] // 左侧显示时间的左上角顶点坐标
  timeRB: [number, number] = [0, 0] // 左侧显示时间的右下角顶点坐标
  dayLT: [number, number] = [0, 0] // 顶部显示日期的左上角顶点坐标
  dayRB: [number, number] = [0, 0] // 顶部显示日期的右下角顶点坐标
  verticalScrollbarLT: [number, number] = [0, 0] // 竖向滚动条左上角顶点坐标
  verticalScrollbarRB: [number, number] = [0, 0] // 竖向滚动条右下角顶点坐标
  horizontalScrollbarLT: [number, number] = [0, 0] // 水平滚动条左上角顶点坐标
  horizontalScrollbarRB: [number, number] = [0, 0] // 水平滚动条右下角顶点坐标

  dayRenderer: DayRenderer
  gridLineRenderer: GridLineRenderer
  nowTimeRenderer: NowTimeRenderer
  scheduleRenderer: ScheduleRenderer
  scrollbarRenderer: ScrollbarRenderer
  timeRenderer: TimeRenderer

  /** 渲染数据LRUCache */
  private __renderDateLRUCache: LRUCache<string, ScheduleRenderData[]> = new LRUCache(7)
  // /** 尺寸更新锁 */
  // private __sizeUpdate: boolean = false
  // /** 偏移更新锁 */
  // private __offsetUpdate: boolean = false
  // /** 缩放更新锁 */
  // private __scaleUpdate: boolean = false
  // /** 悬浮更新锁 */
  // private __hoverUpdate: boolean = false
  // private __themeUpdate: boolean = false
  private __needRender: boolean = false

  private __options: LoongCalendaerRendererOptions

  /**
   * 作节流
   */
  private renderDataUpdateThrottle = throttle(this.renderDataUpdate)

  constructor(loong: LoongCalendarManager, options: LoongCalendaerRendererOptions) {
    super(loong)

    this.yScale = Math.max(1, options.gridRendererOptions.yScale)

    this.__loong.on('canvas-online', this.canvasOnline, this)
    this.__loong.on('canvas-offline', this.canvasOffline, this)
    this.__loong.on('frame-update', this.frameUpdate, this)

    this.__loong.on('resize', this.resize, this)
    this.__loong.on('canvas-x-zoom-in', this.xZoomIn, this)
    this.__loong.on('canvas-x-zoom-out', this.xZoomOut, this)
    this.__loong.on('canvas-y-zoom-in', this.yZoomIn, this)
    this.__loong.on('canvas-y-zoom-out', this.yZoomOut, this)
    this.__loong.on('mouse-move', this.mouseMove, this)
    this.__loong.on('mouse-in', this.mouseIn, this)
    this.__loong.on('mouse-out', this.mouseOut, this)
    this.__loong.on('mouse-down', this.mouseDown, this)
    this.__loong.on('mouse-up', this.mouseUp, this)
    this.__loong.on('mouse-click', this.mouseClick, this)
    this.__loong.on('one-second-passed', this.oneSecondPassed, this)
    this.__loong.on('scroll-up', this.scrollUp, this)
    this.__loong.on('scroll-down', this.scrollDown, this)
    this.__loong.on('render-data-update', this.renderDataUpdateThrottle, this)
    this.__loong.on('render-type-change', this.renderTypeChange, this)
    this.__loong.on('theme-change', this.themeChange, this)
    // this.__loong.on('render-data-in', this.renderDataIn, this)
    // this.__loong.on('render-data-out', this.renderDataOut, this)
    this.__loong.on('force-render', this.forceRender, this)

    this.__options = options

    this.dayRenderer = new DayRenderer(this, options.dateRendererOptions)
    this.timeRenderer = new TimeRenderer(this, options.timeRendererOptions)
    this.nowTimeRenderer = new NowTimeRenderer(this, options.currentTimeRendererOptions)
    this.scrollbarRenderer = new ScrollbarRenderer(this, options.scrollbarRendererOptions)
    this.gridLineRenderer = new GridLineRenderer(this, options.gridRendererOptions)
    this.scheduleRenderer = new ScheduleRenderer(this, options.scheduleRendererOptions)
  }

  getScheduleRenderData(date: Date) {
    return this.__renderDateLRUCache.get(date.toLocaleDateString())
  }

  private canvasOnline() {
    const canvas = document.getElementById(this.__loong.id) as HTMLCanvasElement
    this.__canvas = canvas
    this.__ctx = canvas.getContext('2d')
    this.resize()
  }

  private canvasOffline() {
    this.__canvas = null
    this.__ctx = null
  }

  private themeChange() {
    const options = this.__loong.options.analyseOptions()
    this.__options = options
    this.dayRenderer.destroy()
    this.timeRenderer.destroy()
    this.nowTimeRenderer.destroy()
    this.scrollbarRenderer.destroy()
    this.gridLineRenderer.destroy()
    this.scheduleRenderer.destroy()

    this.dayRenderer = new DayRenderer(this, options.dateRendererOptions)
    this.timeRenderer = new TimeRenderer(this, options.timeRendererOptions)
    this.nowTimeRenderer = new NowTimeRenderer(this, options.currentTimeRendererOptions)
    this.scrollbarRenderer = new ScrollbarRenderer(this, options.scrollbarRendererOptions)
    this.gridLineRenderer = new GridLineRenderer(this, options.gridRendererOptions)
    this.scheduleRenderer = new ScheduleRenderer(this, options.scheduleRendererOptions)
    this.__needRender = true
  }

  /**
   * 帧更新，检查日期渲染队列
   */
  private frameUpdate() {
    let needRender = false
    /** 检查数据是否有更新 */
    const dates = this.__loong.manager.rendererDates.value
    const l = dates.length
    for (let i = 0; i < l; i++) {
      const res = this.__loong.manager.getScheduleRenderData(dates[i])
      if (res === undefined || res === null) continue
      else {
        this.__renderDateLRUCache.set(dates[i].toLocaleDateString(), res)
        needRender = true
      }
    }
    /** 检查页面布局是否有更新（滚动、放缩、移动、浮动）*/
    needRender = needRender || this.__needRender
    /** 检查是否需要重新渲染 */
    if (needRender) {
      this.__needRender = false
      /** 渲染 */
      this.render()
    }
  }

  private resize() {
    if (this.__canvas === null || this.__ctx === null) return
    this.canvasWidth = this.__canvas.clientWidth
    this.canvasHeight = this.__canvas.clientHeight
    const dpr = window.devicePixelRatio || 1 // 获取设备像素比
    this.__canvas.width = this.canvasWidth * dpr
    this.__canvas.height = this.canvasHeight * dpr
    this.__ctx.scale(dpr, dpr)
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private scrollUp() {
    if (this.__canvas === null || this.yOffset === 0) return
    this.yOffset += this.__scrollOffset
    this.render()
  }

  private scrollDown() {
    if (this.__canvas === null) return
    this.yOffset -= this.__scrollOffset
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private xZoomIn() {
    if (this.__canvas === null) return
    if (!this.__mouseIsIn) return
    this.xScale += this.xStep * this.xScale
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private xZoomOut() {
    if (this.__canvas === null || this.xScale === 1) return
    if (!this.__mouseIsIn) return
    this.xScale -= this.xStep * this.xScale
    this.xScale = Math.max(this.xScale, 1)
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private yZoomIn() {
    if (this.__canvas === null) return
    if (!this.__mouseIsIn) return
    this.yScale += this.yStep * this.yScale
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private yZoomOut() {
    if (this.__canvas === null || this.yScale === 1) return
    if (!this.__mouseIsIn) return
    this.yScale -= this.yStep * this.yScale
    this.yScale = Math.max(this.yScale, 1)
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private mouseMove(event: MouseEvent) {
    if (this.__canvas === null) return
    this.scrollbarRenderer.mouseMove(event)
    this.currentMouseX = event.offsetX
    this.currentMouseY = event.offsetY
    if (this.__mouseIsDown) {
      const diffX = event.offsetX - this.mouseX
      const diffY = event.offsetY - this.mouseY
      // 在单日模式下禁用水平滚动
      if (this.__loong.manager.type.value === 'week') {
        this.xOffset += this.__reversalXInput ? -diffX : diffX
      }
      this.yOffset += this.__reversalYInput ? -diffY : diffY
      /** 需要重新渲染 */
      this.__needRender = true
      this.__loong.emit('change-canvas-cursor-pointer', 'grabbing', 'add')
    }
    this.mouseX = event.offsetX
    this.mouseY = event.offsetY
  }

  private mouseIn() {
    if (this.__canvas === null) return
    this.__mouseIsIn = true
  }

  private mouseOut() {
    if (this.__canvas === null) return
    this.__mouseIsIn = false
  }

  private mouseDown(event: MouseEvent) {
    if (this.__canvas === null) return
    const x = event.offsetX
    const y = event.offsetY
    if (x >= this.calendarLT[0] && x <= this.calendarRB[0] && y >= this.calendarLT[1] && y <= this.calendarRB[1]) {
      this.__mouseIsDown = true
      this.mouseX = event.offsetX
      this.mouseY = event.offsetY
      this.__loong.emit('change-canvas-cursor-pointer', 'grab', 'add')
    }
    if (x >= this.horizontalScrollbarLT[0] && x <= this.horizontalScrollbarRB[0] && y >= this.horizontalScrollbarLT[1] && y <= this.horizontalScrollbarRB[1]) {
      this.scrollbarRenderer.downInHThumb(event)
    }
    if (x >= this.verticalScrollbarLT[0] && x <= this.verticalScrollbarRB[0] && y >= this.verticalScrollbarLT[1] && y <= this.verticalScrollbarRB[1]) {
      this.scrollbarRenderer.downInVThumb(event)
    }
  }

  private mouseUp(event: MouseEvent) {
    if (this.__canvas === null) return
    this.__mouseIsDown = false
    this.scrollbarRenderer.mouseUp()
    this.__loong.emit('change-canvas-cursor-pointer', 'grab', 'remove')
    this.__loong.emit('change-canvas-cursor-pointer', 'grabbing', 'remove')
  }

  private mouseClick(event: MouseEvent) {}

  private oneSecondPassed() {
    if (this.__canvas === null) return
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private forceRender() {
    if (this.__canvas === null) return
    this.render()
  }

  private renderDataUpdate() {
    if (this.__canvas === null) return
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private renderDataIn(schedule: ScheduleRenderData) {
    // if (this.__canvas === null) return
    // this.render()
  }

  private renderDataOut(schedule: ScheduleRenderData) {
    // if (this.__canvas === null) return
    // this.render()
  }

  private renderTypeChange(type: 'date' | 'week') {
    if (this.__canvas === null) return
    if (type === 'date') {
      const res = this.gridLineRenderer.calculateShowDay()
      this.xScale = res[0]
      this.yScale = res[1]
      this.xOffset = res[2]
      this.yOffset = res[3]
    } else {
      this.xOffset = 0
      this.yOffset = 0
      this.xScale = 1
      this.yScale = 1
    }
    this.__fouse = true
    /** 需要重新渲染 */
    this.__needRender = true
  }

  updateOffset(x: number, y: number, resetX: boolean = false, resetY: boolean = false) {
    if (this.__canvas === null) return
    this.xOffset = resetX ? x : this.xOffset + x
    this.yOffset = resetY ? y : this.yOffset + y
    /** 需要重新渲染 */
    this.__needRender = true
  }

  private render() {
    const ctx = this.ctx
    if (ctx === null) return
    ctx.save()
    ctx.translate(0, 0)
    ctx.clearRect(-100, -100, this.canvasWidth + 100, this.canvasHeight + 100)
    // 计算尺寸
    this.calculate()
    if (!this.__fouse) {
    // 检查scale
      const scaleRes = this.gridLineRenderer.checkScale()
      this.xScale = scaleRes[0]
      this.yScale = scaleRes[1]
      this.xOffset = scaleRes[2]
      this.yOffset = scaleRes[3]
      // 检查offset是否合法
      const offsetRes = this.gridLineRenderer.checkOffset()
      this.xOffset = offsetRes[0]
      this.yOffset = offsetRes[1]
    }
    this.lastXScale = this.xScale
    this.lastYScale = this.yScale
    this.__fouse = false
    // 绘制
    if (this.__options.gridRendererOptions.backgroundColor !== 'transparent' && this.__options.gridRendererOptions.backgroundColor !== '') {
      ctx.fillStyle = this.__options.gridRendererOptions.backgroundColor
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
    }
    this.gridLineRenderer.render(ctx) // 画网格线
    this.timeRenderer.render(ctx) // 画左侧时间
    this.scheduleRenderer.render(ctx) // 画日程
    this.nowTimeRenderer.render(ctx) // 画当前时间
    this.dayRenderer.render(ctx) // 画顶部日期
    this.scrollbarRenderer.render(ctx) // 画滚动条
    ctx.restore()
  }

  /**
   * 计算各个区域的大小
   */
  private calculate() {
    const canvasWidth = this.canvasWidth
    const canvasHeight = this.canvasHeight
    this.dayLT = [this.timeRenderer.width, 0]
    this.dayRB = [canvasWidth - this.scrollbarRenderer.size, this.dayRenderer.height]
    this.timeLT = [0, this.dayRenderer.height]
    this.timeRB = [this.timeRenderer.width, canvasHeight - this.scrollbarRenderer.size]
    this.verticalScrollbarLT = [this.dayRB[0], 0]
    this.verticalScrollbarRB = [this.dayRB[0] + this.scrollbarRenderer.size, canvasHeight - this.scrollbarRenderer.size]
    this.horizontalScrollbarLT = [0, this.timeRB[1]]
    this.horizontalScrollbarRB = [canvasWidth - this.scrollbarRenderer.size, canvasHeight]
    this.calendarLT = [this.timeRenderer.width, this.dayRenderer.height]
    this.calendarRB = [canvasWidth - this.scrollbarRenderer.size, canvasHeight - this.scrollbarRenderer.size]
  }

  protected destroy(): void {}
}
