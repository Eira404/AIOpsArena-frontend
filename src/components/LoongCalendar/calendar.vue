<script setup lang="ts">
import { destoryCalendar } from './index.ts'
import { onBeforeUnmount } from 'vue'
import controller from './controller.vue'

const props = defineProps({
  id: {
    type: String,
    default: 'myCanvas'
  },
  destory: {
    type: Boolean,
    default: true
  }
})

onBeforeUnmount(() => {
  if (props.destory) destoryCalendar(props.id)
})
</script>

<template>
  <div style="width: 100%; height: 100%;">
    <div style="height: 60px;">
      <controller :id="id">
        <template #headerCenter>
          <slot name="headerCenter" />
        </template>
        <template #headerRightHead>
          <slot name="headerRightHead" />
        </template>
        <template #headerRightTail>
          <slot name="headerRightTail" />
        </template>
      </controller>
    </div>
    <div style="height: calc(100% - 60px); position: relative;">
      <canvas
        :id="id"
        width="1000"
        height="1000"
        style="width: 100%; height: 100%;"
      />
      <div style="position: absolute; top: 0; left: 0; pointer-events: none; user-select: none; width: 100%; height: 100%; overflow: hidden;">
        <slot name="canvasCenter" />
      </div>
    </div>
  </div>
</template>
