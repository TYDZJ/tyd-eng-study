<script setup>
import wordCard from '@/components/word-card.vue';
import topNav from '@/components/top-nav.vue';

const wordData = {
  word: 'hello',
  phonetic: '/həˈloʊ/',
  translation: '你好',
  sentence: 'hello world'
};
</script>

<template>
  <view class="word-detail-box">
    <top-nav title="单词详情" />
    <word-card />
  </view>
</template>

<style lang="scss" scoped>
.word-detail-box {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  // background: #ffe3e3;
  background: #dee8ff;
}
</style>