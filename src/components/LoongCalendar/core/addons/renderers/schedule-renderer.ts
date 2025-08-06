import type { LoongCalendarScheduleRendererOptions } from '../../../types'
import { ScheduleRenderData } from '../loong-addon-manager'
import type { Renderer } from '../loong-addon-renderer'
import { RendererBase } from './renderer-base'

export class ScheduleRenderer extends RendererBase {
  private __showSchedule: [ScheduleRenderData, number, number, number, number][] = []
  private __activeSchedule: ScheduleRenderData | null = null
  private __options: LoongCalendarScheduleRendererOptions
  private __renderMap: (ScheduleRenderData | null) [][] = []
  private __mouseIsMove = false
  private __mouseIsDown = false

  constructor(renderer: Renderer, options: LoongCalendarScheduleRendererOptions) {
    super(renderer)

    this.__options = options

    this.__renderer.__loong.on('mouse-move', this.mouseMove, this)
    this.__renderer.__loong.on('mouse-click', this.click, this)
    this.__renderer.__loong.on('mouse-down', this.mouseDown, this)
    this.__renderer.__loong.on('mouse-up', this.mouseUp, this)
    this.__renderer.__loong.on('mouse-double-click', this.dblClick, this)
    this.__renderer.__loong.on('mouse-out', this.mouseOut, this)
  }

  destroy(): void {
    this.__renderer.__loong.off('mouse-move', this.mouseMove, this)
    this.__renderer.__loong.off('mouse-click', this.click, this)
    this.__renderer.__loong
    this.__renderer.__loong.off('mouse-double-click', this.dblClick, this)
  }

  mouseDown() {
    this.__mouseIsDown = true
  }

  mouseUp() {
    this.__mouseIsDown = false
  }

  mouseOut() {
    // if (this.__activeSchedule === null) return
    // /** 鼠标移出日程 */
    // this.__renderer.__loong.emit('schedule-mouse-out', this.__activeSchedule)
    // this.__activeSchedule = null
    // this.__renderer.__loong.emit('change-canvas-cursor-pointer', 'pointer', 'remove')
    // this.__renderer.__loong.emit('force-render')
  }

  click(event: MouseEvent) {
    if (this.__mouseIsMove) {
      this.__mouseIsMove = false
      return
    }
    if (this.__activeSchedule === null) return
    this.__renderer.__loong.emit('schedule-mouse-click', event, this.__activeSchedule)
  }

  dblClick(event: MouseEvent) {
    if (this.__mouseIsMove) {
      this.__mouseIsMove = false
      return
    }
    if (this.__activeSchedule === null) return
    this.__renderer.__loong.emit('schedule-mouse-double-click', event, this.__activeSchedule)
  }

  mouseMove(event: MouseEvent) {
    if (this.__mouseIsDown) {
      this.__mouseIsMove = true
    }
    const l = this.__showSchedule.length
    const calendarLT  = this.__renderer.calendarLT
    const calendarRB  = this.__renderer.calendarRB
    const cl = calendarLT[0]
    const ct = calendarLT[1]
    /** 检查鼠标是否有浮动情况 */
    const mouseCX = this.__renderer.currentMouseX - cl
    const mouseCY = this.__renderer.currentMouseY - ct
    if (this.__renderMap[mouseCY] && this.__activeSchedule === null && this.__renderMap[mouseCY][mouseCX] instanceof ScheduleRenderData) {
      /** 鼠标移入日程 */
      this.__activeSchedule = this.__renderMap[mouseCY][mouseCX]
      this.__renderer.__loong.emit('schedule-mouse-in', this.__activeSchedule)
      this.__renderer.__loong.emit('change-canvas-cursor-pointer', 'pointer', 'add')
      this.__renderer.__loong.emit('force-render')
    } else if (this.__activeSchedule !== null && (this.__renderMap[mouseCY] === undefined || !(this.__renderMap[mouseCY][mouseCX] instanceof ScheduleRenderData))) {
      /** 鼠标移出日程 */
      this.__renderer.__loong.emit('schedule-mouse-out', this.__activeSchedule)
      this.__activeSchedule = null
      this.__renderer.__loong.emit('change-canvas-cursor-pointer', 'pointer', 'remove')
      this.__renderer.__loong.emit('force-render')
    } else if (this.__renderMap[mouseCY] && this.__activeSchedule !== null && this.__renderMap[mouseCY][mouseCX] instanceof ScheduleRenderData) {
      if (this.__activeSchedule.id === this.__renderMap[mouseCY][mouseCX].id) {
        /** 在日程内移动 */
      } else {
        /** 鼠标移出日程 */
        this.__renderer.__loong.emit('schedule-mouse-out', this.__activeSchedule)
        /** 鼠标移入日程 */
        this.__activeSchedule = this.__renderMap[mouseCY][mouseCX]
        this.__renderer.__loong.emit('schedule-mouse-in', this.__activeSchedule)
        this.__renderer.__loong.emit('force-render')
      }
    }
    if (mouseCX >= 0 && mouseCX < calendarRB[0] && mouseCY >= 0 && mouseCY < calendarRB[1] && this.__activeSchedule) {
      this.__renderer.__loong.emit('schedule-mouse-move', event, this.__activeSchedule)
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const canvasWidth = this.__renderer.canvasWidth
    const canvasHeight = this.__renderer.canvasHeight
    /** 尺寸不对，需要更新尺寸 */
    if (this.__renderMap.length !== canvasHeight || this.__renderMap[0] === undefined || this.__renderMap[0].length !== canvasWidth) {
      this.__renderMap = []
      for (let i = 0; i < canvasHeight; i++) {
        this.__renderMap[i] = Array(canvasWidth).fill(null)
      }
    } else {
      for (let i = 0; i < canvasHeight; i++) {
        for (let j = 0; j < canvasWidth; j++) {
          this.__renderMap[i][j] = null
        }
      }
    }
    const schedulePos = this.__renderer.gridLineRenderer.schedulePos
    this.__showSchedule = []
    /** 计算需要渲染的日程 */
    schedulePos.forEach((scheduleP) => {
      const dbtp = scheduleP[0].getTime()
      this.renderSchedules(ctx, scheduleP[0], dbtp, dbtp + scheduleP[1], dbtp + scheduleP[2], scheduleP[3], scheduleP[4])
    })
    /** 检查鼠标是否有浮动情况 */
    const calendarLT  = this.__renderer.calendarLT
    const cl = calendarLT[0]
    const ct = calendarLT[1]
    const mouseCX = this.__renderer.currentMouseX - cl
    const mouseCY = this.__renderer.currentMouseY - ct
    let activeS: null | ScheduleRenderData = null
    if (this.__renderMap[mouseCY] && this.__renderMap[mouseCY][mouseCX] instanceof ScheduleRenderData) {
      activeS = this.__renderMap[mouseCY][mouseCX]
    }
    /** 渲染 */
    const vw = this.__renderer.gridLineRenderer.calendarCurrentViewWidth
    const vh = this.__renderer.gridLineRenderer.calendarCurrentViewHeight
    ctx.save()
    ctx.translate(cl, ct)
    ctx.beginPath()
    ctx.rect(0, 1, vw, vh - 1) // 裁剪区域
    ctx.clip() // 应用裁剪区域
    let acticeD: [ScheduleRenderData, number, number, number, number] | null = null
    this.__showSchedule.forEach((schedule) => {
      if (activeS !== null && schedule[0].id === activeS.id) {
        acticeD = schedule
        return
      }
      this.renderShedule(ctx, schedule[0], schedule[1], schedule[2], schedule[3], schedule[4])
    })
    if (acticeD) {
      this.renderActiveShedule(ctx, acticeD[0], acticeD[1], acticeD[2], acticeD[3], acticeD[4])
    }
    ctx.restore()
  }

  private renderSchedules(
    ctx: CanvasRenderingContext2D,
    date: Date,
    dateBeginTimestamp: number,
    stratTimestamp: number,
    endTimestamp: number,
    left: number,
    width: number
  ) {
    const dayMS = 24 * 60 * 60 * 1000
    const fullHeight = this.__renderer.gridLineRenderer.calendarCurrentHeight
    const xOffset  = this.__renderer.gridLineRenderer.calendarCurrentXOffset
    const yOffset = this.__renderer.gridLineRenderer.calendarCurrentYOffset
    const schedules = this.__renderer.getScheduleRenderData(date)
    if (schedules === undefined) return
    const l = schedules.length
    for (let i = 0; i < l; i++) {
      const schedule = schedules[i]
      const stp = schedule.startTimestamp
      const etp = schedule.endTimestamp
      if (etp < stratTimestamp) continue
      if (stp > endTimestamp) continue
      const timeYOffset = (stp - dateBeginTimestamp) / dayMS * fullHeight + yOffset
      const timeHeight = (etp - stp) / dayMS * fullHeight
      const timeLeft = schedule.left * width + left
      const timeWidth = schedule.width * width
      this.changeMapNullToSchedule(schedule, timeLeft, timeYOffset, timeWidth, timeHeight)
      this.__showSchedule.push([schedule, timeLeft, timeYOffset, timeWidth, timeHeight])
    }
  }

  private renderShedule(
    ctx: CanvasRenderingContext2D,
    schedule: ScheduleRenderData,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const color = schedule.schedule.color
    ctx.fillStyle = this.__options.dark ? this.darkenColor(color) + '40' : this.lightenColor(color)
    this.drawCapsuleRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1)
    ctx.fillStyle = color
    this.drawCapsuleRect(ctx, x + 0.5, y + 0.5, 4, height - 1, 2)
    this.renderText(ctx, schedule, x, y, width, height)
  }

  private changeMapNullToSchedule(schedule: ScheduleRenderData, x: number, y: number, width: number, height: number) {
    x = Math.ceil(x)
    y = Math.ceil(y)
    width = Math.ceil(width)
    height = Math.ceil(height)
    for (let i = y; i < y + height; i++) {
      for (let j = x; j < x + width; j++) {
        if (i < 0  || i >= this.__renderMap.length || j < 0 || j >= this.__renderMap[0].length) continue
        this.__renderMap[i][j] = schedule
      }
    }
  }

  private renderActiveShedule(
    ctx: CanvasRenderingContext2D,
    schedule: ScheduleRenderData,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const color = schedule.schedule.color
    ctx.fillStyle = this.__options.dark ? color + 'A0' : color
    this.drawCapsuleOuterShadow(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 4, color + '50')
    ctx.fillStyle = this.__options.color
    this.renderText(ctx, schedule, x, y, width, height)
  }

  private renderText(
    ctx: CanvasRenderingContext2D,
    schedule: ScheduleRenderData,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    ctx.save()
    const title = schedule.schedule.title
    const content = schedule.schedule.content
    const startTime = schedule.schedule.scheduleBaseData.startTime
    const endTime = schedule.schedule.scheduleBaseData.endTime
    const startTimeStr = startTime instanceof Date ? startTime.toLocaleString() : `${startTime[0].toString().padStart(2, '0')}:${startTime[1].toString().padStart(2, '0')}:${startTime[2].toString().padStart(2, '0')}`
    const endTimeStr = endTime instanceof Date ? endTime.toLocaleString() : `${endTime[0].toString().padStart(2, '0')}:${endTime[1].toString().padStart(2, '0')}:${endTime[2].toString().padStart(2, '0')}`
    ctx.beginPath()
    ctx.rect(x + 5, y + 1, width - 8, height - 2) // 裁剪区域
    ctx.clip()
    // 渲染文字
    ctx.font = `${this.__options.titleFontSize}px ${this.__options.titleFontFamily}`
    const textW = ctx.measureText(title).width
    if (textW > width - 8 || height - 6 < this.__options.titleFontSize) {
      ctx.restore()
      return
    }

    ctx.fillText(title, x + 10, y + this.__options.titleFontSize + 3)
    ctx.font = `${this.__options.contentFontSize}px ${this.__options.contentFontFamily}`
    ctx.fillText(content, x + 10, y + this.__options.titleFontSize + this.__options.contentFontSize + 3 * 2)
    ctx.font = `${this.__options.timeFontSize}px ${this.__options.timeFontFamily}`
    const minH = this.__options.titleFontSize + this.__options.contentFontSize
    ctx.fillText('Start: ' + startTimeStr, x + 10, y + minH + this.__options.timeFontSize + 3 * 4)
    ctx.fillText('End: ' + endTimeStr, x + 10, y + minH + this.__options.timeFontSize * 2 + 3 * 5)
    ctx.restore()
  }

  private lightenColor(hexColor: string): string {
    // 将十六进制颜色字符串转换为 RGB
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(3, 5), 16)
    const b = parseInt(hexColor.slice(5, 7), 16)

    // 定义亮度增加的量（可以根据需要调整）
    const increase = 0.9 // 亮度增加的比例

    // 计算新的 RGB 分量
    const newR = Math.floor(Math.min(255, r + (255 - r) * increase))
    const newG = Math.floor(Math.min(255, g + (255 - g) * increase))
    const newB = Math.floor(Math.min(255, b + (255 - b) * increase))

    // 将新的 RGB 分量转换回十六进制字符串
    const newHexColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`

    return newHexColor
  }

  private darkenColor(hexColor: string): string {
    // 将十六进制颜色字符串转换为 RGB
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(3, 5), 16)
    const b = parseInt(hexColor.slice(5, 7), 16)

    // 定义亮度减少的量（可以根据需要调整）
    const decrease = 0.1 // 亮度减少的比例

    // 计算新的 RGB 分量
    const newR = Math.floor(Math.max(0, r - r * decrease))
    const newG = Math.floor(Math.max(0, g - g * decrease))
    const newB = Math.floor(Math.max(0, b - b * decrease))

    // 将新的 RGB 分量转换回十六进制字符串
    const newHexColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`

    return newHexColor
  }
}
