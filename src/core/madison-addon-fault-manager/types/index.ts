import type { Ref } from 'vue'

export interface FaultParam {
  name: string
  category: string
  type: string
  description: string
  params: Record<
    string,
    {
      type: string
      description: string
    }
  >
}

export type GetFaultParamsRes = Record<string, FaultParam>

export interface InjectExperimentOptions {
  templateName: string
  faultType: string
  clockTime: string
  params: Record<string, any>
}

export interface InjectScheduleOptions {
  templateName: string
  faultType: string
  schedule: string
  params: Record<string, any>
}

export interface GetFutureInjectionOptions {
  startTime: number
  endTime: number
  namespace: string
}

export interface GetFutureInjectionRes {
  task_id: string
}

export interface GetHistoryInjectionOptions {
  startTime: number
  endTime: number
  namespace: string
}

export interface GetHistoryInjectionRes {
  task_id: string
}

export interface GetInjectionResOptions {
  taskId: string
}

export interface GetInjectionResItem {
  id: string
  name: string
  timestamp: number
  kind: string
  spec: {
    selector: any
    mode: string
    action: string
    duration: string
  }
}

export interface GetInjectionResItemHistory {
  id: string
  name: string
  timestamp: number
  kind: string
  spec: {
    selector: any
    mode: string
    action: string
    duration: string
  }
}

export interface GetInjectionResRes {
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE'
  result: GetInjectionResItem[] | Record<string, GetInjectionResItemHistory>
}

export interface GetInjectionResForManager {
  id: string
  name: string
  kind: string
  timestamp: number
  duration: number
  category: string
  type: string
  meta?: any
}

export interface DeleteFaultOptions {
  faultId: string
}

export type ParamsMapValue =
  | {
      value: Ref<string[]>
      component: 'el-select-multiple'
      name: 'targetpods'
      type: 'array'
      meta: any
      description: string
      options: { label: string; value: string }[]
    }
  | {
      value: Ref<string[]>
      component: 'el-select-multiple'
      name: 'pods'
      type: 'array'
      meta: any
      description: string
      options: { label: string; value: string }[]
    }
  | {
      value: Ref<string>
      component: 'el-select'
      name: 'namespace'
      type: 'string'
      meta: any
      description: string
      options: { label: string; value: string }[]
    }
  | {
      value: Ref<string>
      component: 'el-input'
      name: string
      type: 'string'
      meta: any
      description: string
    }
  | {
      value: Ref<number>
      component: 'el-input-number'
      name: string
      type: 'number'
      meta: any
      description: string
    }
  | {
      value: Ref<string[]>
      component: 'el-select-multiple'
      name: string
      type: 'array'
      meta: any
      description: string
      options: { label: string; value: string }[]
    }
