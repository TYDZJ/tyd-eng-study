<script setup>
import { callEntryCloud } from "@/utils/wx-cloud-call";
import { useUserStore } from "@/stores/user";

const emit = defineEmits(['success'])
const userStore = useUserStore();
/**
 * 根据openId一键登录/注册
 */
const onQuickLogin = async () => {
  uni.showLoading({
    title: 'Loading...'
  })

  try {
    const res = await callEntryCloud({
      action: "wxQuickLogin",
    });
    const result = res?.result || {};

    if (result.code !== 0) {
      throw new Error(result.message || "登录失败");
    }

    userStore.setAuthInfo(result?.data || {});
    if (!userStore.checkIsLoggedIn()) {
      throw new Error("登录失败：未获取到会话信息");
    }
    emit("success");
  } catch (error) {
    console.error('登录失败:', error)
    uni.showToast({
      title: error?.message || '登录失败',
      icon: 'error',
      duration: 2000
    })
  } finally {
    uni.hideLoading()
  }
}
</script>

<template>
  <view class="login-box">
    <button
      class="login-btn"
      @click="onQuickLogin"
    >
      微信一键登录
    </button>
    <button
      class="login-btn"
      @click=""
    >
      账户密码登录
    </button>
    <button
      class="login-btn"
      @click=""
    >
      注册
    </button>
  </view>
</template>

<style lang="scss" scoped>
.login-btn {
  width: 80%;
  height: 100rpx;
  background-color: #fff;
  border-radius: 12rpx;
  border: 1px solid black;
  color: #333;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
