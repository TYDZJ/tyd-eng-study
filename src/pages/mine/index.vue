<script setup>
import { ref } from 'vue';

import TopNav from '@/components/top-nav.vue'
import loginPopup from '../../components/login-popup.vue';

const showLoginPopup = ref(false);
const openLoginPopup = () => {
  showLoginPopup.value = true;
}

</script>

<template>
  <view class="mine-box">
    <TopNav title="我的" />
    <view class="content">
      <view class="title">mine</view>
      <view class="login-btn" @click="openLoginPopup">点击登录</view>
    </view>
    <loginPopup :show="showLoginPopup" @close="showLoginPopup = false" />
  </view>
</template>

<style lang="scss" scoped>
    
</style>