<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '../stores/data'

const props = defineProps<{ memberId: string; limit?: number }>()
const data = useDataStore()

const events = computed(() => {
  const list = data.timelineOf(props.memberId)
  return props.limit ? list.slice(0, props.limit) : list
})

const kindColor: Record<string, string> = {
  预约体验: 'gray', 安排体验: 'gray', 购课: '', 排课: 'gray',
  上课记录: '', 请假: 'amber', 改期: 'amber', 不适上报: 'danger',
  课程调整: 'clay', 更换教练: 'clay', 续费: '', 投诉: 'danger', 工单处理: 'gray', 体验测评: 'clay',
  延期: 'amber',
}
</script>

<template>
  <div class="timeline">
    <div v-for="e in events" :key="e.id" class="tl-item" :class="{ pro: e.professional }">
      <div class="tl-time">{{ e.at }} · {{ e.actorName }}（{{ { member: '会员', coach: '教练', consultant: '顾问' }[e.actorRole] }}）</div>
      <div class="tl-title">
        {{ e.title }}
        <span class="tag" :class="kindColor[e.kind]">{{ e.kind }}</span>
        <span v-if="e.professional" class="tag clay">专业记录</span>
      </div>
      <div class="tl-detail">{{ e.detail }}</div>
    </div>
    <div v-if="!events.length" class="empty">暂无记录</div>
  </div>
</template>
