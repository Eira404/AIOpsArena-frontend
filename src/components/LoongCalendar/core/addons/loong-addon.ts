import type { LoongCalendarManager } from '../../'

export abstract class LoongAddon {
  readonly __loong: LoongCalendarManager

  constructor(loong: LoongCalendarManager) {
    this.__loong = loong
    this.__loong.on('destory', this.destroy, this)
  }

  protected abstract destroy(): void
}
