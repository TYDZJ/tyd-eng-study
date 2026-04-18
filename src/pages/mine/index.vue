<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/stores/user';
import TopNav from '@/components/top-nav.vue'
import loginPopup from '../../components/login-popup.vue';
import { callEntryCloud } from '@/utils/wx-cloud-call';

const userStore = useUserStore();
const showLoginPopup = ref(false);

// 判断是否已登录
const isLoggedIn = computed(() => userStore.isLoggedIn);

// 用户信息
const userInfo = computed(() => userStore.profile || {});

// 页面显示时刷新用户信息（包括从其他页面返回时）
onShow(async () => {
  if (isLoggedIn.value) {
    await refreshUserProfile();
  }
});

// 刷新用户资料
const refreshUserProfile = async () => {
  uni.showLoading({
    title: '加载中...'
  });
  try {
    const res = await callEntryCloud({
      action: "getAuthProfile"
    });
    
    const result = res?.result;
    
    // 检查云函数是否调用成功
    if (!result) {
      throw new Error('云函数调用失败');
    }
    
    // 处理业务错误
    if (result.code !== 0) {
      // 40101: token 失效（兜底处理）
      if (result.code === 40101) {
        userStore.clearAuth();
        return; // callEntryCloud 已处理跳转
      }
      
      // 40401: 用户不存在，可能是数据异常
      if (result.code === 40401) {
        console.error('用户数据异常:', result.message);
        userStore.clearAuth();
        uni.showToast({
          title: '用户数据异常，请重新登录',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      // 其他业务错误
      console.error('获取用户信息失败:', result.message);
      uni.showToast({
        title: result.message || '获取用户信息失败',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 成功：更新本地store中的profile
    if (result.data && result.data.user) {
      userStore.setProfile({
        ...result.data.user,
        has_password: result.data.has_password
      });
    }
  } catch (error) {
    // 这里只处理网络异常或 JS 运行时错误
    console.error('获取用户信息异常:', error);
    uni.showToast({
      title: '网络异常，请稍后重试',
      icon: 'none',
      duration: 2000
    });
  } finally {
    // 无论成功还是失败，都隐藏 Loading
    uni.hideLoading();
  }
};

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
const handleLogout = async () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({
          title: '退出中...'
        });
        
        try {
          // 先调用后端撤销会话
          await callEntryCloud({ action: "logout" });
        } catch (error) {
          // 即使后端调用失败，也要清除本地状态
          console.error('退出登录失败:', error);
        } finally {
          // 清除前端本地状态
          userStore.logout();
          uni.hideLoading();
          uni.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
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
        <text class="nickname">{{ isLoggedIn ? userInfo.nickname || '匿名用户' : '未登录' }}</text>
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
          <text class="menu-arrow">{{ '&gt;' }}</text>
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