<script setup>
import TopNav from '@/components/top-nav.vue'

import Card from './components/card.vue'
import Learn from './components/learn.vue'
import Spell from './components/spell.vue'

import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getLearnWords } from '@/utils/wx-cloud-call'

const learnModel = ref('card')
const learnWords = ref([])
const loading = ref(false)

async function loadLearnWords() {
  loading.value = true
  try {
    const result = await getLearnWords({
      bookId: 'cet4',
      count: 20,
    })
    if (result?.code === 0) {
      learnWords.value = result?.data?.words || []
    } else {
      learnWords.value = []
      uni.showToast({
        title: result?.message || '加载学习词失败',
        icon: 'none',
      })
    }
  } catch (error) {
    learnWords.value = []
    uni.showToast({
      title: '云函数调用失败',
      icon: 'none',
    })
    console.error('[learn] getLearnWords error', error)
  } finally {
    loading.value = false
  }
}

onLoad(() => {
  loadLearnWords()
})

</script>

<template>
  <view class="learn-box">
    <TopNav />
    <view class="status-line">
      <text v-if="loading">学习词加载中...</text>
      <text v-else>当前已获取学习词：{{ learnWords.length }} 个</text>
    </view>
    <Card class="learn-item" v-if="learnModel === 'card'" />
    <Learn class="learn-item" v-if="learnModel === 'learn'" />
    <Spell class="learn-item" v-if="learnModel === 'spell'" />
    <view class="change-box">
      <button @click="learnModel = 'card'">卡片</button>
      <button @click="learnModel = 'learn'">学习</button>
      <button @click="learnModel = 'spell'">拼写</button>
    </view>
    <u-safe-bottom />
  </view>
</template>

<style lang="scss" scoped>
.learn-box {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;

  .learn-item {
    flex: 1;
    padding: 0 30rpx;
  }
}

.status-line {
  padding: 8rpx 30rpx;
  font-size: 24rpx;
  color: #666;
}

.change-box {
  position: absolute;
  top: 100rpx;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 30rpx;

  button { 
    margin: 0;
  }
}
</style>