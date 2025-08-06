import { LoongCanvasCursorLevel, type LoongCanvasCursor } from '../../types'
import type { LoongCalendarManager } from '../../'
import { BinaryHeap } from '../utils'
import { LoongAddon } from './loong-addon'

export class Events extends LoongAddon {
  private __canvas: HTMLCanvasElement | null = null

  private __vIsDown = false
  private __hIsDown = false

  private __cursorMaxHeap: BinaryHeap<LoongCanvasCursor> = new BinaryHeap((a, b) => LoongCanvasCursorLevel[a] > LoongCanvasCursorLevel[b], true)

  private __oneSecondTimer: null | NodeJS.Timeout = null

  private __requestAnimationFrameStop: () => void

  private __mouseIn = () => { this.__cursorMaxHeap.clear(); this.__cursorMaxHeap.insert('default'); this.__loong.emit('mouse-in') }
  private __mouseOut = () => { this.__cursorMaxHeap.clear(); this.__cursorMaxHeap.insert('default'); this.__loong.emit('mouse-out') }
  private __mouseMouve = (event: MouseEvent) => { this.__loong.emit('mouse-move', event) }
  private __mouseDown = (event: MouseEvent) => { this.__loong.emit('mouse-down', event) }
  private __mouseUp = (event: MouseEvent) => { this.__loong.emit('mouse-up', event) }
  private __mouseClick = (event: MouseEvent) => { this.__loong.emit('mouse-click', event) }
  private __mouseDoubleClick = (event: MouseEvent) => { this.__loong.emit('mouse-double-click', event) }

  private __resize = () => { this.__loong.emit('resize') }

  private __keyDown = (event: KeyboardEvent) => {
    if (event.key === 'h') {
      this.__hIsDown = true
    }
    if (event.key === 'v') {
      this.__vIsDown = true
    }
    if (event.key === '=' && this.__vIsDown) {
      this.__loong.emit('canvas-y-zoom-in')
    }
    if (event.key === '-' && this.__vIsDown) {
      this.__loong.emit('canvas-y-zoom-out')
    }
    if (event.key === '=' && this.__hIsDown) {
      this.__loong.emit('canvas-x-zoom-in')
    }
    if (event.key === '-' && this.__hIsDown) {
      this.__loong.emit('canvas-x-zoom-out')
    }
  }

  private __keyUp = (event: KeyboardEvent) => {
    if (event.key === 'h') {
      this.__hIsDown = false
    }
    if (event.key === 'v') {
      this.__vIsDown = false
    }
  }

  private __wheel = (event: WheelEvent) => {
    if (event.target !== this.__canvas) return
    event.preventDefault()
    if (this.__hIsDown) {
      // 水平缩放
      if (event.deltaY < 0) {
        this.__loong.emit('canvas-x-zoom-in')
      } else {
        this.__loong.emit('canvas-x-zoom-out')
      }
    } else if (this.__vIsDown) {
      // 垂直缩放
      if (event.deltaY < 0) {
        this.__loong.emit('canvas-y-zoom-in')
      } else {
        this.__loong.emit('canvas-y-zoom-out')
      }
    } else {
      // 滚动
      if (event.deltaY < 0) {
        this.__loong.emit('scroll-up')
      } else {
        this.__loong.emit('scroll-down')
      }
    }
  }

  constructor(loong: LoongCalendarManager) {
    super(loong)

    this.__loong.on('canvas-online', this.canvasOnline, this)
    this.__loong.on('canvas-offline', this.canvasOffline, this)
    this.__loong.on('change-canvas-cursor-pointer', this.changeCanvasCursorPointer, this)
    /** 该循环一直在线 */
    this.__requestAnimationFrameStop = this.startAnimationLoop()
  }

  private canvasOnline(canvas: HTMLCanvasElement) {
    this.__canvas = canvas
    canvas.addEventListener('mousemove', this.__mouseMouve)
    canvas.addEventListener('mousedown', this.__mouseDown)
    canvas.addEventListener('mouseup', this.__mouseUp)
    window.addEventListener('resize', this.__resize)
    window.addEventListener('mouseup', this.__mouseUp)
    canvas.addEventListener('click', this.__mouseClick)
    canvas.addEventListener('mouseenter', this.__mouseIn)
    canvas.addEventListener('mouseleave', this.__mouseOut)
    window.addEventListener('keydown', this.__keyDown)
    window.addEventListener('keyup', this.__keyUp)
    window.addEventListener('wheel', this.__wheel, { passive: false })
    canvas.addEventListener('dblclick', this.__mouseDoubleClick)
    this.startOneMinuteTimer()
  }

  private canvasOffline() {
    this.__canvas = null
    window.removeEventListener('mouseup', this.__mouseUp)
    window.removeEventListener('resize', this.__resize)
    window.removeEventListener('keydown', this.__keyDown)
    window.removeEventListener('keyup', this.__keyUp)
    window.removeEventListener('wheel', this.__wheel)
    if (this.__oneSecondTimer) clearInterval(this.__oneSecondTimer)
  }

  /**
   * 控制canvas的鼠标浮动样式
   * @param cursor 鼠标样式
   */
  private changeCanvasCursorPointer = (cursor: 'default' | 'pointer' | 'grabbing' | 'grab', state: 'add' | 'remove') => {
    if (state === 'add') {
      this.__cursorMaxHeap.insert(cursor)
    } else {
      this.__cursorMaxHeap.remove(cursor)
    }
  }

  private updateCanvasCursor() {
    if (this.__canvas) {
      const cursor = this.__cursorMaxHeap.peek()
      if (cursor) {
        this.__canvas.style.cursor = cursor
      } else {
        this.__canvas.style.cursor = 'default'
      }
    }
  }

  private startOneMinuteTimer() {
    if (this.__oneSecondTimer) clearInterval(this.__oneSecondTimer)
    this.__oneSecondTimer = setInterval(() => {
      this.__loong.emit('one-second-passed')
    }, 1000)
  }

  private startAnimationLoop(): () => void {
    let frameId: number | NodeJS.Timeout | null = null
    const tryRequestAnimationFrame = () => {
      frameId = requestAnimationFrame(() => {
        this.updateCanvasCursor()
        this.__loong.emit('frame-update')
        tryRequestAnimationFrame()
      })
    }
    try {
      tryRequestAnimationFrame()
      console.log('使用 requestAnimationFrame 启动动画循环')
    } catch (error) {
      console.warn('requestAnimationFrame 不可用，使用 60Hz 的计时器代替')
      const intervalId = setInterval(() => {
        console.log('requestAnimationFrame by setInterval')
        this.updateCanvasCursor()
        this.__loong.emit('frame-update')
      }, 1000 / 60)
      frameId = intervalId
    }
    const stopAnimationLoop = () => {
      if (frameId !== null) {
        if (typeof frameId === 'number') {
          cancelAnimationFrame(frameId)
        } else {
          clearInterval(frameId)
        }
        console.log('动画循环已停止')
      }
    }
    return stopAnimationLoop
  }

  protected destroy(): void {
    this.canvasOffline()
    this.__requestAnimationFrameStop()
  }
}
