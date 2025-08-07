<script setup lang="ts">
import { ElDatePicker, ElRadioGroup, ElRadioButton, ElTooltip, ElIcon } from 'element-plus'
import { computed } from 'vue'
import { useCalendar } from './index.ts'
import { useI18n } from 'vue-i18n'
const props = defineProps({
  id: {
    type: String,
    required: true
  }
})
const { t } = useI18n()
const calendar = useCalendar(props.id)
const date = calendar.manager.controllerValue
const type = calendar.manager.type
const format = computed(() => {
  return type.value === 'date' ? 'YYYY-MM-DD' : 'YYYY-[Week]-ww'
})
</script>

<template>
  <div style="width: 100%; height: 100%; display: flex; align-items: center; padding-left: 2rem; padding-right: 2rem; box-sizing: border-box; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 1rem;">
      <div>
        <el-date-picker
          v-model="date"
          :type="type"
          :format="format"
          :editable="false"
          :clearable="false"
        />
      </div>
      <div style="display: flex; align-items: center; justify-content: center;">
        <el-tooltip
          effect="light"
          placement="bottom"
        >
          <template #content>
            {{ t('FaultInjection.Question.Q1') }}
            <br>
            {{ t('FaultInjection.Question.Q2') }}
            <br>
            {{ t('FaultInjection.Question.Q3') }}
          </template>
          <el-icon size="24">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1024 1024"
            ><path
              fill="currentColor"
              d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896m23.744 191.488c-52.096 0-92.928 14.784-123.2 44.352-30.976 29.568-45.76 70.4-45.76 122.496h80.256c0-29.568 5.632-52.8 17.6-68.992 13.376-19.712 35.2-28.864 66.176-28.864 23.936 0 42.944 6.336 56.32 19.712 12.672 13.376 19.712 31.68 19.712 54.912 0 17.6-6.336 34.496-19.008 49.984l-8.448 9.856c-45.76 40.832-73.216 70.4-82.368 89.408-9.856 19.008-14.08 42.24-14.08 68.992v9.856h80.96v-9.856c0-16.896 3.52-31.68 10.56-45.76 6.336-12.672 15.488-24.64 28.16-35.2 33.792-29.568 54.208-48.576 60.544-55.616 16.896-22.528 26.048-51.392 26.048-86.592 0-42.944-14.08-76.736-42.24-101.376-28.16-25.344-65.472-37.312-111.232-37.312zm-12.672 406.208a54.272 54.272 0 0 0-38.72 14.784 49.408 49.408 0 0 0-15.488 38.016c0 15.488 4.928 28.16 15.488 38.016A54.848 54.848 0 0 0 523.072 768c15.488 0 28.16-4.928 38.72-14.784a51.52 51.52 0 0 0 16.192-38.72 51.968 51.968 0 0 0-15.488-38.016 55.936 55.936 0 0 0-39.424-14.784z"
            /></svg>
          </el-icon>
        </el-tooltip>
      </div>
      <!-- <div>
        显示记录数量{{ calendar.manager.rendererWeek.value[0] }}
        {{ calendar.manager.renderWeek }}
      </div> -->
    </div>
    <div>
      <slot name="headerCenter" />
    </div>
    <div style="display: flex; align-items: center; gap: 1rem;">
      <div>
        <slot name="headerRightHead" />
      </div>
      <div>
        <el-radio-group v-model="type">
          <el-radio-button
            label="Date"
            value="date"
          />
          <el-radio-button
            label="Week"
            value="week"
          />
        </el-radio-group>
      </div>
      <div>
        <slot name="headerRightTail" />
      </div>
    </div>
  </div>
</template>
