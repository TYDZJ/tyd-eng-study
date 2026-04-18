<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import TopNav from '@/components/top-nav.vue';
import { useUserStore } from '@/stores/user';
import { callEntryCloud } from '@/utils/wx-cloud-call';

const userStore = useUserStore();

// 用户信息
const userInfo = computed(() => userStore.profile || {});

// 判断是否已登录
const isLoggedIn = computed(() => userStore.isLoggedIn);

// 页面显示时刷新用户信息
onShow(async () => {
  if (isLoggedIn.value) {
    await refreshUserProfile();
  }
});

// 刷新用户资料
const refreshUserProfile = async () => {
  try {
    const res = await callEntryCloud({
      action: "getAuthProfile"
    });
    
    const result = res?.result;
    
    if (!result) {
      throw new Error('云函数调用失败');
    }
    
    // 处理业务错误
    if (result.code !== 0) {
      // 40101: token 失效（兜底处理）
      if (result.code === 40101) {
        userStore.clearAuth();
        return;
      }
      
      console.error('获取用户信息失败:', result.message);
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
    console.error('获取用户信息异常:', error);
  }
};

// 前往账号信息页面
const goToAccountInfo = () => {
  uni.navigateTo({
    url: '/pages/mine/update'
  });
};

// 退出登录
const handleLogout = () => {
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
          await callEntryCloud({
            action: "logout"
          });
        } catch (error) {
          console.error('退出登录调用失败:', error);
          // 即使后端调用失败，也要清除前端状态
        } finally {
          // 无论成功还是失败，都清除前端状态
          userStore.logout();
          uni.hideLoading();
          
          uni.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟返回首页
          setTimeout(() => {
            uni.reLaunch({
              url: '/pages/index/index'
            });
          }, 1500);
        }
      }
    }
  });
};
</script>

<template>
  <view class="setting-box">
    <top-nav title="更多设置" />
    
    <view class="setting-content">
      <!-- 账号信息卡片 -->
      <view class="info-card" @click="goToAccountInfo">
        <view class="card-header">
          <text class="card-title">账号信息</text>
          <u-icon name="arrow-right" size="16" color="#999"></u-icon>
        </view>
        
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">昵称</text>
            <text class="info-value">{{ userInfo.nickname || userInfo.username || '未设置' }}</text>
          </view>
          
          <view class="info-row">
            <text class="info-label">账号</text>
            <text class="info-value">{{ userInfo.username || '未设置' }}</text>
          </view>
          
          <view class="info-row">
            <text class="info-label">ID</text>
            <text class="info-value info-id">{{ userInfo.user_id || '-' }}</text>
          </view>
        </view>
      </view>
      
      <!-- 退出登录按钮 -->
      <view v-if="isLoggedIn" class="logout-section">
        <button class="logout-btn" @click="handleLogout">
          退出登录
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.setting-box {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.setting-content {
  padding: 30rpx;
}

// 账号信息卡片
.info-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  
  .card-header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20rpx;
    border-bottom: 1rpx solid #f0f0f0;
    margin-bottom: 20rpx;
    
    .card-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
    }
  }
  
  .card-body {
    .info-row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding: 16rpx 0;
      
      &:not(:last-child) {
        border-bottom: 1rpx solid #f8f8f8;
      }
      
      .info-label {
        font-size: 28rpx;
        color: #666;
      }
      
      .info-value {
        font-size: 28rpx;
        color: #333;
        max-width: 400rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        
        &.info-id {
          color: #999;
          font-size: 24rpx;
        }
      }
    }
  }
}

// 退出登录区域
.logout-section {
  margin-top: 60rpx;
  
  .logout-btn {
    width: 100%;
    height: 88rpx;
    line-height: 88rpx;
    background-color: #fff;
    color: #ff4d4f;
    font-size: 32rpx;
    border-radius: 16rpx;
    border: none;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
    
    &::after {
      border: none;
    }
    
    &:active {
      opacity: 0.7;
    }
  }
}
</style>
