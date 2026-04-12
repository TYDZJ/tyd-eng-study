<script setup>
import TopNav from '@/components/top-nav.vue'

import Card from './components/card.vue'
import Learn from './components/learn.vue'
import Spell from './components/spell.vue'

import { ref } from 'vue'

const learnModel = ref('card')

</script>

<template>
  <view class="learn-box">
    <TopNav />
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