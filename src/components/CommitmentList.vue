<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '../stores/data'

/**
 * 课包承诺记录：延期 / 调频 / 续费 / 沟通承诺全部落字，
 * 会员、顾问、店长看到的是同一份 —— 防止口头延期产生争议。
 */
const props = defineProps<{ packageId: string }>()
const data = useDataStore()

const list = computed(() => data.commitmentsOf(props.packageId))

const kindClass: Record<string, string> = { 延期: 'amber', 调频: 'clay', 续费: '', 沟通承诺: 'gray' }
const roleLabel: Record<string, string> = { member: '会员', coach: '教练', consultant: '顾问', manager: '店长' }
</script>

<template>
  <div>
    <div v-for="c in list" :key="c.id" class="mb8" style="border-bottom: 1px dashed var(--line); padding-bottom: 8px">
      <div>
        <span class="tag" :class="kindClass[c.kind]">{{ c.kind }}</span>
        <span class="muted">{{ c.createdAt }} · {{ c.actorName }}（{{ roleLabel[c.actorRole] ?? c.actorRole }}）</span>
      </div>
      <div style="font-size: 14px">{{ c.content }}</div>
    </div>
    <div v-if="!list.length" class="empty">暂无承诺记录</div>
  </div>
</template>
