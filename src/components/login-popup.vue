<script setup>
import Login from './login.vue';

const props = defineProps({
  // 是否显示登录弹窗
  show: {
    type: Boolean,
    default: false
  },
  // 关闭时是否返回上一页
  isBack: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'success'])

const onClose = () => {
  // 如果 isBack 为 true，关闭弹窗时返回上一页
  if (props.isBack) {
    uni.navigateBack({
      delta: 1,
      fail: () => {
        // 如果没有上一页，则跳转到首页
        uni.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
  emit('close')
}

// 监听登录组件的登录成功状态
const handleLoginSuccess = () => {
  uni.showToast({
    title: '登录成功',
    icon: 'success',
    duration: 1000
  })
  setTimeout(() => {
    emit('success')
    // 登录成功后自动关闭弹窗
    onClose()
  }, 1000)
}

</script>

<template>
  <u-popup mode="bottom" :show="props.show" @close="onClose" :closeable="true">
    <view class="login-popup-box">
      <view class="title">
        <view class="left">
          <text class="text1">欢迎登入</text>
          <text class="text2">xxxxxxxx</text>
        </view>
        <view class="icon"></view>
      </view>
      <login @success="handleLoginSuccess" />
    </view>
  </u-popup>
</template>

<style lang="scss" scoped>
.login-popup-box {
  margin-top: 50rpx;
  padding: 40rpx 60rpx;
  display: flex;
  flex-direction: column;
  gap: 60rpx;

  .title {
    height: 96rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .left {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-left: 10rpx;
      border-left: 10rpx solid #5914c9;

      .text1 {
        font-size: 30rpx;
      }
      .text2 {
        font-size: 36rpx;
        font-weight: bold;
      }
    }
    .icon {
      width: 96rpx;
      height: 96rpx;
      background-color: #5914c9;
      border-radius: 12rpx;
    }
  }
}
</style>
