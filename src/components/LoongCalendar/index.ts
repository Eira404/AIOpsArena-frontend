import EventEmitter from 'eventemitter3'
import type { LoongCalendarOptions, LoongEvents } from './types'
import { Renderer } from './core/addons/loong-addon-renderer'
import { Observer } from './core/addons/loong-addon-observer'
import { Events } from './core/addons/loong-addon-events'
import { Manager } from './core/addons/loong-addon-manager'
import { Options } from './core/addons/loong-addon-options'
import LoongCalendar from './calendar.vue'

export { LoongCalendar }

export * from './core'

function consoleLC() {
  console.log(
    `LoongCalendar!!! 🐉
___________________
|  Sun.  |  Mon.  |
|________|________|
|  xxxx  |  xxxx  |
|________|________|
`
  )
}

export class LoongCalendarManager extends EventEmitter<LoongEvents> {
  private __map

  readonly id: string
  readonly renderer: Renderer
  readonly observer: Observer
  readonly manager: Manager
  readonly events: Events
  readonly options: Options

  private __oneSecondTimer: null | NodeJS.Timeout = null

  constructor(id: string, options: LoongCalendarOptions, map: Map<string, LoongCalendarManager>) {
    super()

    consoleLC()

    this.__map = map
    this.id = id

    this.options = new Options(this, options)
    const useOptions = this.options.analyseOptions()
    this.renderer = new Renderer(this, useOptions)
    this.observer = new Observer(this)
    this.manager = new Manager(this)
    this.events = new Events(this)

    this.init()
  }

  private init() {
    this.on('canvas-online', this.canvasOnline, this)
    this.on('canvas-offline', this.canvasOffline, this)
  }

  private canvasOnline() {
    this.startOneMinuteTimer()
  }

  private canvasOffline() {
    if (this.__oneSecondTimer) clearInterval(this.__oneSecondTimer)
  }

  private startOneMinuteTimer() {
    if (this.__oneSecondTimer) clearInterval(this.__oneSecondTimer)
    this.__oneSecondTimer = setInterval(() => {
      this.emit('one-second-passed')
    }, 1000)
  }

  useTheme(theme: string) {
    this.options.useTheme(theme)
  }

  clear() {
    this.emit('clear')
  }

  destroy() {
    this.__map.delete(this.id)
    if (this.__oneSecondTimer) clearInterval(this.__oneSecondTimer)
    this.removeAllListeners()
    this.emit('destory')
  }
}

const map = new Map<string, LoongCalendarManager>()

export function useCalendar(id: string, options: LoongCalendarOptions = {}) {
  if (!map.has(id)) map.set(id, new LoongCalendarManager(id, options, map))
  return map.get(id) as LoongCalendarManager
}

export function destoryCalendar(id: string) {
  if (!map.has(id)) return false
  const calendar = map.get(id) as LoongCalendarManager
  calendar.destroy()
  map.delete(id)
  return true
}
