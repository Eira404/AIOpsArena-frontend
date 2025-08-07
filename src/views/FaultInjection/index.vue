<script setup lang="ts">
import Structure from '@/components/Structrue/index.vue'
import { CalendarFaultsManager } from '@/core/madison-addon-fault-manager/core/fault-history'
import FaultCalendarPrompt from '@/components/FaultCalendarPrompt/index.vue'
import FaultManager from '@/components/FaultManager/index.vue'
import card from './card.vue'
import { useMadison } from '@/core/madison'
import { useCalendar, LoongCalendar, type ScheduleRenderData } from '@/components/LoongCalendar'
import { onBeforeUnmount, ref } from 'vue'
import faultDetail from './fault-detail.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const calendar = useCalendar(CalendarFaultsManager.CAL_KEY)
const madison = useMadison()
const faultManager = madison.faultManager
const currentRenderDataLoaded = faultManager.calendarFaultsManager.currentRenderDataLoaded
const namespaceIsValid = faultManager.calendarFaultsManager.namespaceIsValid

calendar.on('schedule-mouse-click', clickFault)

const drawerVisible = ref(false)
const displayFault = ref<null | ScheduleRenderData>(null)

function clickFault(event: MouseEvent, fault: ScheduleRenderData) {
  displayFault.value = fault
  drawerVisible.value = true
}

onBeforeUnmount(() => {
  calendar.off('schedule-mouse-click', clickFault)
})
</script>

<template>
  <Structure :main-full="true">
    <template #main>
      <div class="w-full h-full overflow-x-hidden relative">
        <!-- <FaultManager /> -->
        <div class="relative h-full">
          <LoongCalendar
            :id="CalendarFaultsManager.CAL_KEY"
            :destory="false"
          >
            <template #headerCenter>
              <div class="flex gap-2 items-center">
                <FaultManager />
                <FaultCalendarPrompt />
              </div>
            </template>
            <template #canvasCenter>
              <div
                class="relative flex justify-center items-center w-full h-full"
              >
                <card />
              </div>
            </template>
          </LoongCalendar>
        </div>
        <div
          v-if="!namespaceIsValid"
          class="w-full h-full flex justify-center items-center top-0 left-0 absolute"
        >
          <p class="text-4xl text-pink-500 font-bold text-center leading-[48px]">
            {{ t('FaultInjection.PleaseSelectANamespace.PLSGoto') }}
            <router-link
              class="text-moonlight-500"
              to="microservice"
            >
              {{ t('FaultInjection.PleaseSelectANamespace.Microservice') }}
            </router-link>
            {{ t('FaultInjection.PleaseSelectANamespace.Or') }}
            <router-link
              class="text-moonlight-500"
              to="testbed"
            >
              {{ t('FaultInjection.PleaseSelectANamespace.Testbed') }}
            </router-link>
            <br>
            {{ t('FaultInjection.PleaseSelectANamespace.LastS') }}
          </p>
        </div>
        <el-drawer
          v-model="drawerVisible"
          :title="t('FaultInjection.DetailDialog.FaultDetail')"
          direction="rtl"
          :size="500"
        >
          <faultDetail
            :key="displayFault === null ? 'unknown' : displayFault.id"
            :fault="(displayFault as ScheduleRenderData)"
            @close="drawerVisible = false; displayFault = null"
          />
        </el-drawer>
      </div>
    </template>
  </Structure>
</template>
