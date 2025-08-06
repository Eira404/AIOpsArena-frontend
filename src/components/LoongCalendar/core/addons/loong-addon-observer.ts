import type { LoongCalendarManager } from '../../'
import { LoongAddon } from './loong-addon'

export class Observer extends LoongAddon {
  private __observer: MutationObserver
  private __canvasIsReady = false

  constructor(loong: LoongCalendarManager) {
    super(loong)

    this.__observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const canvas = document.getElementById(this.__loong.id)
          if (canvas === null && this.__canvasIsReady) {
            // canvas被移除
            this.__canvasIsReady = false
            this.__loong.emit('canvas-offline')
          }
          if (canvas !== null && !this.__canvasIsReady) {
            // canvas被添加
            this.__canvasIsReady = true
            this.__loong.emit('canvas-online', canvas as HTMLCanvasElement)
          }
        }
      })
    })
    const config = {
      childList: true, // 观察子节点的变化（添加、删除）
      subtree: true // 观察目标节点及其所有后代节点
    }

    // 开始观察
    const targetNode = document.body
    this.__observer.observe(targetNode, config)

    setTimeout(() => {
      const canvas = document.getElementById(this.__loong.id)
      if (canvas !== null) {
        this.__canvasIsReady = true
        this.__loong.emit('canvas-online', canvas as HTMLCanvasElement)
      }
    }, 0)
  }

  protected destroy(): void {
    this.__observer.disconnect()
  }
}
