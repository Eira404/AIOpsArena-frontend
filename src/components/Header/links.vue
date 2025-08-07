<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()

const navList = [
  ['Nav.Home', '/', 'home'],
  ['Nav.Microservice', '/microservice', 'microservice'],
  ['Nav.Testbed', '/testbed', 'testbed'],
  ['Nav.FaultInjection', '/fault-injection', 'faultinjection'],
  ['Nav.Data', '/data', 'data'],
  ['Nav.Dataset', '/dataset', 'dataset']
  // ['Nav.Algorithm', '/algorithm', 'algorithm']
  // ['Nav.Template', '/template', 'template'],
  // ['Nav.Evaluation', '/evaluation', 'evaluation'],
  // ['Nav.Leaderboard', '/leaderboard', 'leaderboard']
]
</script>

<template>
  <div class="h-full flex gap-4 items-center">
    <router-link
      v-for="nav, i in navList"
      :key="i"
      :to="nav[1]"
      class="hover:text-moonlight-500 transition-all h-full flex items-center box-border border-b-2 border-transparent"
      :class="{'border-b-2 !border-moonlight-500': route.matched.find((item) => item.name === nav[2]) !== undefined}"
    >
      {{ t(nav[0]) }}
    </router-link>
  </div>
</template>
