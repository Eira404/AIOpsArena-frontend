import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
NProgress.configure({ showSpinner: false })

import { Madison } from '@/core/madison'
import { useCalendar } from '@/components/LoongCalendar'
import { CalendarFaultsManager } from '@/core/madison-addon-fault-manager/core/fault-history'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home/index.vue')
    },
    {
      path: '/microservice',
      name: 'microservice',
      component: () => import('../views/Microservice/index.vue')
    },
    {
      path: '/visitor',
      name: 'visitor',
      component: () => import('../views/Visitor/index.vue'),
      redirect: '/visitor/login',
      children: [
        {
          path: 'login',
          name: 'login',
          component: () => import('../components/Login/index.vue'),
          alias: '/login'
        },
        {
          path: 'register',
          name: 'register',
          component: () => import('../components/Register/index.vue'),
          alias: '/register'
        },
        {
          path: 'retrieve',
          name: 'retrieve',
          component: () => import('../components/Retrieve/index.vue'),
          alias: '/retrieve'
        }
      ]
    },
    {
      path: '/testbed',
      name: 'testbed',
      component: () => import('../views/Testbed/index.vue')
    },
    {
      path: '/fault-injection',
      name: 'faultinjection',
      component: () => import('../views/FaultInjection/index.vue')
    },
    {
      path: '/data',
      name: 'data',
      component: () => import('../views/Data/index.vue'),
      children: [
        {
          path: 'traces',
          name: 'traces',
          component: () => import('../views/Data/Traces/index.vue')
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('../views/Data/Logs/index.vue')
        },
        {
          path: 'metrics',
          name: 'metrics',
          component: () => import('../views/Data/Metrics/index.vue'),
          redirect: (to) => {
            return {
              name: 'metricsmachine',
              query: {
                namespace: to.query.namespace
              }
            }
          },
          children: [
            {
              path: 'machine',
              name: 'metricsmachine',
              component: () => import('../views/Data/Metrics/Machine/index.vue'),
              redirect: (to) => {
                return {
                  name: 'metricsmachinenode',
                  query: {
                    namespace: to.query.namespace
                  }
                }
              },
              children: [
                {
                  path: 'node',
                  name: 'metricsmachinenode',
                  component: () => import('../views/Data/Metrics/Machine/Node/index.vue')
                },
                {
                  path: 'pod',
                  name: 'metricsmachinepod',
                  component: () => import('../views/Data/Metrics/Machine/Pod/index.vue')
                }
              ]
            }
          ]
        },
        {
          path: 'trace',
          name: 'tracesearch',
          component: () => import('../views/Data/Trace/index.vue')
        },
        {
          path: 'trace/:id',
          name: 'trace',
          component: () => import('../views/Data/Trace/index.vue')
        },
        {
          path: 'metric',
          name: 'metric',
          component: () => import('../views/Data/Metric/index.vue'),
          children: [
            {
              path: 'machine',
              name: 'metricmachine',
              component: () => import('../views/Data/Metric/Machine/index.vue')
            },
            {
              path: 'service',
              name: 'metricservice',
              component: () => import('../views/AboutView.vue')
            },
            {
              path: 'business',
              name: 'metricbusiness',
              component: () => import('../views/AboutView.vue')
            }
          ]
        },
        {
          path: ':pathMatch(.*)*',
          name: 'dataNotFound',
          redirect: '/data'
        }
      ]
    },
    {
      path: '/dataset',
      name: 'dataset',
      component: () => import('../views/Dataset/index.vue')
    },
    // {
    //   path: '/algorithm',
    //   name: 'algorithm',
    //   component: () => import('../views/test.vue')
    // },
    // {
    //   path: '/template',
    //   name: 'template',
    //   component: () => import('../views/AboutView.vue')
    // },
    // {
    //   path: '/evaluation',
    //   name: 'evaluation',
    //   component: () => import('../views/AboutView.vue')
    // },
    // {
    //   path: '/leaderboard',
    //   name: 'leaderboard',
    //   component: () => import('../views/HomeView.vue')
    // },
    // {
    //   path: '/about',
    //   name: 'about',
    //   // route level code-splitting
    //   // this generates a separate chunk (About.[hash].js) for this route
    //   // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/AboutView.vue')
    // },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      redirect: '/'
    }
  ]
})

/** 配置LoongCalendar样式，要比实例化Madison早 */
useCalendar(CalendarFaultsManager.CAL_KEY, {
  grid: {
    yScale: 5
  },
  categories: ['pod', 'service', 'Unknown']
})

const madison = Madison.getInstance(router)

router.beforeEach(async (to, from, next) => {
  NProgress.start()
  // console.log('beforeEach ready to precheck')
  if (!madison.routerPromise.precheck(to, from, next)) return
  // console.log('beforeEach precheck finish, ready to check')
  if (!(await madison.routerPromise.check(to, from, next))) return
  // console.log('beforeEach check finish')
  next()
})

router.afterEach((to, from, failure) => {
  // console.log('afterEach ready to postcheck')
  madison.routerPromise.postcheck(to, from)
  // console.log('afterEach postcheck finish')
  NProgress.done()
})

export default router
