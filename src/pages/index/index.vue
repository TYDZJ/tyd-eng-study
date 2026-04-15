<script setup>
import { ref } from "vue";
import TopNav from "@/components/top-nav.vue";
import LoginPopup from "@/components/login-popup.vue";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();
const showLoginPopup = ref(false);

const ensureLogin = (callback) => {
  // Learn/Review 入口统一走登录门禁：未登录只弹窗，不执行后续跳转。
  if (!userStore.isLoggedIn) {
    showLoginPopup.value = true;
    return;
  }
  callback();
};

const goLearn = () => {
  uni.navigateTo({
    url: '/pages/learn/index?state=learn'
  })
}
const goReview = () => {
  uni.navigateTo({
    url: '/pages/learn/index?state=review'
  })
}

const goPage = (url) => {
  uni.navigateTo({
    url
  })
}
</script>

<template>
  <view class="page-box">
    <TopNav :showBack="false" showSideNav="true" />
    <!-- 签到 -->
    <view class="sign-box">
      <!-- <view class="icon"></view> -->
      <u-icon name="calendar" size="60" color="black"></u-icon>
      <text class="title">签到</text>
      <text class="time">2026-01-01</text>
    </view>

    <view class="learn-box">
      <!-- learn -->
      <view class="learn-item" @click="ensureLogin(goLearn)">
        <text class="title">Learn</text>
        <text class="count">100</text>
      </view>
      <!-- review -->
      <view class="learn-item" @click="ensureLogin(goReview)">
        <text class="title">Review</text>
        <text class="count">50</text>
      </view>
    </view>

    <!-- 按钮组 -->
    <view class="bottom-btns">
      <view class="btn" @click="goPage('/pages/config/index')">配置</view>
      <view class="btn" @click="goPage('/pages/data/index')">数据</view>
      <view class="btn" @click="goPage('/pages/mine/index')">我的</view>
    </view>
    <LoginPopup
      :show="showLoginPopup"
      @close="showLoginPopup = false"
      @success="handleLoginSuccess"
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
