<script setup lang="ts">
import { useMadison } from '@/core/madison'
import { computed, ref, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const margin = 15
const madison = useMadison()
const calendarFaultsManager = madison.faultManager.calendarFaultsManager
const card = ref<HTMLElement>()
const cardTop = calendarFaultsManager.cardTop
const cardLeft = calendarFaultsManager.cardLeft
const mouseClientX = calendarFaultsManager.mouseClientX
const mouseClientY = calendarFaultsManager.mouseClientY
const schedule = calendarFaultsManager.cardSchedule
const visible = calendarFaultsManager.cardVisible
const leftT: ComputedRef<number> = computed(() => {
  if (!card.value) return mouseClientX.value + margin
  const width = window.innerWidth
  const rightPos = mouseClientX.value + margin * 2 + card.value.clientWidth
  if (rightPos > width) return width - card.value.clientWidth - margin * 2
  return mouseClientX.value + margin
})
const topT: ComputedRef<number> = computed(() => {
  if (!card.value) return mouseClientY.value + margin
  const height = window.innerHeight
  const bottomPos = mouseClientY.value + margin * 2 + card.value.clientHeight
  if (bottomPos > height) return height - card.value.clientHeight - margin * 2
  return mouseClientY.value + margin
})
const left = computed(() => {
  return leftT.value + cardLeft.value - mouseClientX.value + 'px'
})
const top = computed(() => {
  return topT.value + cardTop.value - mouseClientY.value + 'px'
})
</script>

<template>
  <div
    v-if="visible"
    ref="card"
    class="absolute rounded bg-bg dark:bg-bg-dark shadow-lg p-4 text-nowrap flex flex-col gap-2"
    :style="{ left: left, top: top }"
  >
    <div>
      <span class="text-lg font-bold mr-3">{{ schedule.title }}</span>
      <span>{{ t('FaultInjection.DetailDialog.Type') }}: {{ schedule.type }}</span>
    </div>
    <div>
      {{ schedule.content }}
    </div>
  </div>
</template>
