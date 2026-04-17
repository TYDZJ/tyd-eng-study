<script setup>
import { ref, computed } from 'vue';
import { useUserStore } from '@/stores/user';
import TopNav from '@/components/top-nav.vue'
import loginPopup from '../../components/login-popup.vue';

const userStore = useUserStore();
const showLoginPopup = ref(false);

// 判断是否已登录
const isLoggedIn = computed(() => userStore.isLoggedIn);

// 用户信息
const userInfo = computed(() => userStore.profile || {});

// 打开登录弹窗
const openLoginPopup = () => {
  showLoginPopup.value = true;
}

// 处理点击事件（未登录时触发登录）
const handleClick = () => {
  if (!isLoggedIn.value) {
    openLoginPopup();
  }
}

// 跳转到个人信息页
const goToProfile = () => {
  if (!isLoggedIn.value) {
    openLoginPopup();
    return;
  }
  uni.navigateTo({
    url: '/pages/mine/update'
  });
}

// 退出登录
const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout();
        uni.showToast({
          title: '已退出登录',
          icon: 'success'
        });
      }
    }
  });
}

// 处理菜单项点击
const handleMenuClick = (item) => {
  // 如果没有配置url，执行默认点击逻辑（未登录时弹出登录框）
  if (!item.url) {
    handleClick();
    return;
  }
  
  // 检查登录状态
  if (!isLoggedIn.value) {
    openLoginPopup();
    return;
  }
  
  // 跳转到对应页面
  uni.navigateTo({
    url: item.url
  });
}

// 功能菜单项
const menuItems = [
  { icon: '📊', name: '数据', url: '' },
  { icon: '⚙️', name: '学习设置', url: '/pages/setting/learn' },
  { icon: '⚙️', name: '更多设置', url: '/pages/setting/index' }
];

</script>

<template>
  <view class="mine-box">
    <TopNav title="我的" />
    
    <view class="content">
      <!-- 头像区域 -->
      <view class="avatar-section" @click="goToProfile">
        <image 
          class="avatar" 
          :src="userInfo.avatar" 
          mode="aspectFill"
        ></image>
        <text class="nickname">{{ userInfo.nickname || '匿名用户' }}</text>
      </view>

      <!-- 功能区 -->
      <view class="menu-card">
        <view 
          v-for="(item, index) in menuItems" 
          :key="index"
          class="menu-item"
          @click="handleMenuClick(item)"
        >
          <view class="menu-left">
            <text class="menu-icon">{{ item.icon }}</text>
            <text class="menu-name">{{ item.name }}</text>
          </view>
          <text class="menu-arrow">></text>
        </view>
      </view>

      <!-- 登录/退出按钮 -->
      <view v-if="!isLoggedIn" class="login-btn" @click="openLoginPopup">
        点击登录
      </view>
      <view v-else class="logout-btn" @click="handleLogout">
        退出登录
      </view>
    </view>

    <u-safe-bottom />

    <loginPopup :show="showLoginPopup" @close="showLoginPopup = false" />
  </view>
</template>

<style lang="scss" scoped>
.mine-box {
  min-height: 100vh;
  background-color: #f5f5f5;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
}

.content {
  padding: 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  flex: 1;
  justify-content: space-between;
}

// 头像区域
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding: 40rpx 0;
  
  .avatar {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    border: 4rpx solid #fff;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
    background-color: #ccc;
  }
  
  .nickname {
    font-size: 32rpx;
    color: #333;
    font-weight: 500;
  }
}

// 功能区卡牌
.menu-card {
  background-color: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
  
  .menu-left {
    display: flex;
    align-items: center;
    gap: 20rpx;
    
    .menu-icon {
      font-size: 40rpx;
    }
    
    .menu-name {
      font-size: 30rpx;
      color: #333;
    }
  }
  
  .menu-arrow {
    font-size: 28rpx;
    color: #999;
  }
}

// 登录按钮
.login-btn {
  margin-top: 40rpx;
  padding: 28rpx 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  text-align: center;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.3);
}

// 退出登录按钮
.logout-btn {
  margin-top: 40rpx;
  padding: 28rpx 0;
  background-color: #fff;
  color: #ff4d4f;
  text-align: center;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: 500;
  border: 2rpx solid #ff4d4f;
}
</style>