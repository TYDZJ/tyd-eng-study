<script setup>
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import TopNav from "@/components/top-nav.vue";
import LoginPopup from "@/components/login-popup.vue";
import { useUserStore } from "@/stores/user";
import { callEntryCloud } from "@/utils/wx-cloud-call";
import dayjs from 'dayjs';

const userStore = useUserStore();
const showLoginPopup = ref(false);

// 首页数据状态
const homeData = ref({
  pendingLearnCount: 0,    // 待学习单词数
  pendingReviewCount: 0,   // 待复习单词数
  isSignedInToday: false,  // 今日是否已签到
  today: ''                // 今日日期
});

/**
 * 获取首页概览数据
 */
async function fetchHomeOverview() {
  // 检查登录状态（未登录不获取）
  if (!userStore.isLoggedIn) {
    console.log('[首页] 未登录，不获取数据');
    return;
  }

  try {
    console.log('[首页] 开始获取数据...');
    const res = await callEntryCloud({
      action: 'getHomeOverview'
    });

    console.log('[首页] 云函数返回:', res);
    const result = res.result || {};
    
    if (result.code === 0 && result.data) {
      const oldData = { ...homeData.value };
      homeData.value = {
        pendingLearnCount: result.data.pendingLearnCount || 0,
        pendingReviewCount: result.data.pendingReviewCount || 0,
        isSignedInToday: result.data.isSignedInToday || false,
        today: result.data.today || ''
      };
      
      console.log('[首页] 数据更新成功');
      console.log('[首页] 旧数据:', oldData);
      console.log('[首页] 新数据:', homeData.value);
      console.log('[首页] isSignedInToday 变化:', oldData.isSignedInToday, '→', homeData.value.isSignedInToday);
    } else {
      console.error('[首页] 数据获取失败:', result.message);
    }
  } catch (error) {
    console.error('[首页] 云函数调用异常:', error);
  }
}

/**
 * 处理签到点击
 */
async function handleSignIn() {
  // 检查登录状态
  if (!userStore.isLoggedIn) {
    showLoginPopup.value = true;
    return;
  }

  // 如果已签到，提示用户
  if (homeData.value.isSignedInToday) {
    uni.showToast({
      title: '今日已签到',
      icon: 'success'
    });
    return;
  }

  try {
    const res = await callEntryCloud({
      action: 'signIn'
    });

    const result = res.result || {};
    
    if (result.code === 0) {
      // 签到成功，重新获取数据以同步状态
      await fetchHomeOverview();
      
      uni.showToast({
        title: '签到成功',
        icon: 'success'
      });
    } else if (result.code === 409) {
      // 已签到，重新获取数据
      await fetchHomeOverview();
      
      uni.showToast({
        title: '今日已签到',
        icon: 'none'
      });
    } else {
      uni.showToast({
        title: result.message || '签到失败',
        icon: 'none'
      });
    }
  } catch (error) {
    console.error('[首页] 签到异常:', error);
    uni.showToast({
      title: '签到失败，请重试',
      icon: 'none'
    });
  }
}

const ensureLogin = (callback) => {
  // Learn/Review 入口统一走登录门禁：未登录只弹窗，不执行后续跳转。
  if (!userStore.isLoggedIn) {
    showLoginPopup.value = true;
    return;
  }
  callback();
};

const goLearn = () => {
  // 检查是否有待学习单词
  if (homeData.value.pendingLearnCount === 0) {
    // 没有待学习单词，弹窗提示用户
    uni.showModal({
      title: '提示',
      content: '当前没有待学习的新词，是否进行额外的学习，如果已学完，可以复习已学过的单词',
      confirmText: '继续学习',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 用户确认，跳转去学习页面
          uni.navigateTo({
            url: '/pages/learn/index?mode=learn'
          });
        }
        // 用户取消，不做任何操作
      }
    });
    return;
  }

  // 有待学习单词，直接跳转
  uni.navigateTo({
    url: '/pages/learn/index?mode=learn'
  });
}
const goReview = () => {
  // 检查是否有待复习单词
  if (homeData.value.pendingReviewCount === 0) {
    // 没有待复习单词，弹窗提示用户
    uni.showToast({
      title: '没有待复习的词了',
      icon: 'none'
    });
    return;
  }
  uni.navigateTo({
    url: '/pages/learn/index?mode=review'
  })
}

const goPage = (url) => {
  uni.navigateTo({
    url
  })
}

// 页面显示时获取数据
onShow(() => {
  fetchHomeOverview();
});
</script>

<template>
  <view class="page-box">
    <TopNav :showBack="false" />
    <!-- 签到 -->
    <view class="sign-box" @click="handleSignIn">
      <!-- <view class="icon"></view> -->
      <u-icon 
        name="calendar" 
        size="60" 
        :color="homeData.isSignedInToday ? '#52c41a' : 'black'"
      ></u-icon>
      <text class="title">{{ homeData.isSignedInToday ? '已签到' : '签到' }}</text>
      <text class="time">{{ homeData.today || dayjs().format('YYYY-MM-DD') }}</text>
    </view>

    <view class="learn-box">
      <!-- learn -->
      <view class="learn-item" @click="ensureLogin(goLearn)">
        <text class="title">Learn</text>
        <text class="count">{{ homeData.pendingLearnCount }}</text>
      </view>
      <!-- review -->
      <view class="learn-item" @click="ensureLogin(goReview)">
        <text class="title">Review</text>
        <text class="count">{{ homeData.pendingReviewCount }}</text>
      </view>
    </view>

    <!-- 按钮组 -->
    <view class="bottom-btns">
      <!-- <view class="btn" @click="goPage('/pages/config/index')">配置</view> -->
      <!-- <view class="btn" @click="goPage('/pages/dash-board/index')">仪表盘</view> -->
      <!-- <view class="btn" @click="goPage('/pages/mine/index')">我的</view> -->
      <u-icon name="grid" size="40" color="black" @click="goPage('/pages/dash-board/index')"></u-icon>
      <u-icon name="account" size="40" color="black" @click="goPage('/pages/mine/index')"></u-icon>
    </view>
    <LoginPopup
      :show="showLoginPopup"
      @close="showLoginPopup = false"
      @success="showLoginPopup = false"
    />
  </view>
</template>

<style lang="scss" scoped>
.page-box {
  height: 100vh;
  width: 100vw;
  position: relative;
  background-color: rgb(147, 204, 253);
}

.sign-box {
  position: absolute;
  top: 200rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 300rpx;
  height: 300rpx;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 32rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  .icon{
    width: 100rpx;
    height: 100rpx;
    background-color: rgba(97, 108, 255, 0.5);
    margin-bottom: 30rpx;
  }
}

.learn-box {
  position: absolute;
  left: 0;
  bottom: 250rpx;
  width: 100vw;
  padding: 0 30rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 30rpx;

  .learn-item {
    // width: 300rpx;
    flex: 1;
    height: 120rpx;
    padding: 20rpx;
    background-color: rgba(255, 255, 255, 0.5);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: start;
    border-radius: 12rpx;
    cursor: pointer;

    .title {
      font-size: 36rpx;
      font-weight: bold;
    }
    .count {
      font-size: 30rpx;
      color: #e74a0c;
    }
  }
}

.bottom-btns {
  position: absolute;
  bottom: 50px;
  left: 0;
  width: 100vw;
  padding: 0 30rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  .btn {
    width: 80rpx;
    height: 80rpx;
    background-color: rgba(97, 108, 255, 0.5);
    border-radius: 12rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 30rpx;
    color: #fff;
    cursor: pointer;
  }
}
</style>
