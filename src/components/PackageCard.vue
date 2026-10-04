<script setup lang="ts">
import { computed } from 'vue'
import type { CoursePackage } from '../types'
import { useDataStore } from '../stores/data'

const props = defineProps<{ pkg: CoursePackage }>()
const data = useDataStore()

const prog = computed(() => data.progressOf(props.pkg))
const pct = computed(() => Math.min(100, Math.round((props.pkg.usedSessions / props.pkg.totalSessions) * 100)))
const coach = computed(() => data.coachById(props.pkg.coachId))
</script>

<template>
  <div>
    <div class="between">
      <div>
        <b>{{ pkg.name }}</b>
        <span class="tag" :class="pkg.status === '进行中' ? '' : 'gray'">{{ pkg.status }}</span>
        <span v-if="prog.behind" class="tag clay">进度落后</span>
        <span v-if="prog.expiringSoon" class="tag danger">续费提醒</span>
        <span v-if="pkg.extensionCount > 0" class="tag amber">已延期 {{ pkg.extensionCount }}/2 次</span>
      </div>
      <span class="muted">教练：{{ coach?.name }}</span>
    </div>
    <div class="mt8 progress"><i :class="{ behind: prog.behind }" :style="{ width: pct + '%' }"></i></div>
    <div class="row mt8" style="font-size: 13px">
      <span>已上 <b>{{ pkg.usedSessions }}</b> / {{ pkg.totalSessions }} 节</span>
      <span class="muted">剩余 {{ prog.remaining }} 节</span>
      <span class="muted">有效期 {{ pkg.startDate }} ~ {{ pkg.expiryDate }}（剩 {{ prog.daysLeft }} 天）</span>
    </div>
    <div class="muted mt8">请假规则：{{ pkg.leaveRule.note }}</div>
  </div>
</template>
