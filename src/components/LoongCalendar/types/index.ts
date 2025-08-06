import type { ScheduleRenderData } from '../core/addons/loong-addon-manager'
export * from './options'
export * from './internal'

export type LoongCanvasCursor = 'default' | 'pointer' | 'grabbing' | 'grab'

export const LoongCanvasCursorLevel: Record<LoongCanvasCursor, number> = {
  default: 0,
  grab: 1,
  pointer: 2,
  grabbing: 3
}

export interface LoongEvents {
  /** 帧更新，由requestAnimationFrame触发，接收此事件的方法执行速度应该被控制 */
  'frame-update': [],
  /** loong calendar 销毁事件 */
  'destory': []
  /** x y 轴上的放缩事件 */
  'canvas-x-zoom-in': []
  'canvas-x-zoom-out': []
  'canvas-y-zoom-in': []
  'canvas-y-zoom-out': []
  /** canvas 出现在页面上事件和消失事件 */
  'canvas-online': [HTMLCanvasElement]
  'canvas-offline': []
  /** window resize */
  'resize': []
  /** 主题变化 */
  'theme-change': [string]
  /** 鼠标事件 绑定的是canvas */
  'mouse-move': [MouseEvent]
  'mouse-in': []
  'mouse-out': []
  'mouse-down': [MouseEvent]
  'mouse-up': [MouseEvent] /** 鼠标事件 额外绑定了window */
  'mouse-click': [MouseEvent]
  'mouse-double-click': [MouseEvent]
  /** 过了一秒 */
  'one-second-passed': []
  /** 直接进行渲染 */
  'force-render': []
  /** 滚动事件 绑定的是window */
  'scroll-up': []
  'scroll-down': []
  /** 渲染时间范围改变 to from */
  'render-time-range-change': ['date' | 'week', Date, Date]
  /** canvas鼠标图标改变 默认：default 0 grab 1 pointer 2 grabbing 3 */
  'change-canvas-cursor-pointer': [LoongCanvasCursor, 'add' | 'remove']

  // 渲染时间范围改变
  'render-data-update': []
  // 渲染的数据更新（可能是增加or删除数据，也可能是切换日期or周）
  'render-type-change': ['date' | 'week']
  // 渲染类型改变
  'calendar-mouse-in': []
  'calendar-mouse-out': []
  'calendar-mouse-click': []
  'calendar-mouse-double-click': []
  // 日历鼠标事件
  'date-mouse-in': []
  'date-mouse-out': []
  'date-mouse-click': []
  'date-mouse-double-click': []
  // 日期的鼠标事件
  'schedule-mouse-in': [ScheduleRenderData]
  'schedule-mouse-out': [ScheduleRenderData]
  'schedule-mouse-move': [MouseEvent, ScheduleRenderData]
  'schedule-mouse-click': [MouseEvent, ScheduleRenderData]
  'schedule-mouse-double-click': [MouseEvent, ScheduleRenderData]
  // 清除所有数据
  'clear': []
  // 恢复初始状态
  'reset': []
}
