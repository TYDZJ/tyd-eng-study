<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 是否显示返回按钮
  showBack: {
    type: Boolean,
    default: true
  },
  // 是否显示侧边栏按钮
  showSideNav: {
    type: Boolean,
    default: false
  },
  // 标题文字
  title: {
    type: String,
    default: ''
  },
  // 自定义样式类名
  customClass: {
    type: String,
    default: ''
  },
  // 自定义样式对象
  customStyle: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['back', 'sideNav'])

// 处理返回按钮点击
const handleBack = () => {
  // emit('back')
  if (getCurrentPages().length === 1) {
    // uni.switchTab({
    //   url: '/pages/index/index'
    // })
    uni.navigateTo({
      url: '/pages/index/index'
    })
  } else {
    uni.navigateBack()
  }
}

// 处理侧边栏按钮点击
const handleSideNav = () => {
  emit('sideNav')
  console.log('侧边栏按钮点击')
}
</script>

<template>
  <view class="top-nav-box" :class="customClass" :style="customStyle">
    <u-status-bar></u-status-bar>
    <view class="top-nav">
      <!-- 左侧区 -->
      <view class="nav-left">
        <slot name="left">
          <view class="left-content">
            <u-icon 
              v-if="showBack" 
              name="arrow-left" 
              size="24" 
              color="#333"
              @click="handleBack"
            ></u-icon>
            <u-icon 
              v-if="showSideNav" 
              name="list" 
              size="24" 
              color="#333"
              class="side-nav-icon"
              @click="handleSideNav"
            ></u-icon>
          </view>
        </slot>
      </view>

      <!-- 中间区 -->
      <view class="nav-center">
        <slot name="center">
          <text class="nav-title">{{ title }}</text>
        </slot>
      </view>

      <!-- 右侧区 -->
      <view class="nav-right">
        <slot name="right"></slot>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.top-nav-box {
  background-color: transparent;
  z-index: 1000;
}

.top-nav {
  height: 44px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
  box-sizing: border-box;
}

.nav-left {
  flex: 0 0 auto;
  min-width: 80rpx;
  display: flex;
  align-items: center;
}

.left-content {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.side-nav-icon {
  margin-left: 8rpx;
}

.nav-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.nav-right {
  flex: 0 0 auto;
  min-width: 80rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
