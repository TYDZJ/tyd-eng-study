<script setup>

const emit = defineEmits(['success'])
/**
 * 根据openId一键登录/注册
 */
const onQuickLogin = async () => { 
  console.log('一键登录');
  uni.showLoading({
    title: 'Loading...'
  })
  
  try {
    // TODO: 调用微信登录接口
    
    // 模拟登录成功
    setTimeout(() => {
      emit('success')
      uni.hideLoading()
    }, 1000)
  } catch (error) {
    console.error('登录失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '登录失败',
      icon: 'error',
      duration: 2000
    })
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
