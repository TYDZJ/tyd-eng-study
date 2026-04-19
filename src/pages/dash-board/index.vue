<script setup>
import { ref, computed } from 'vue';
import { onShow, onReady } from '@dcloudio/uni-app';
import dayjs from 'dayjs';
import TopNav from '@/components/top-nav.vue';
import { useUserStore } from '@/stores/user';
import { callEntryCloud } from '@/utils/wx-cloud-call';

const userStore = useUserStore();
const calendarRef = ref(null);

// 模拟数据 - 在学词书
const currentBook = ref({
  id: 'cet4',
  title: '四级核心词汇',
  desc: '大学英语四级考试核心词汇',
  cover: '', // 可以是图片URL或纯色背景
  learnedCount: 156,
  totalCount: 2000
});

// 学习进度计算
const learnProgress = computed(() => {
  if (!currentBook.value.totalCount) return 0;
  return Math.round((currentBook.value.learnedCount / currentBook.value.totalCount) * 100);
});

// 统计数据
const statistics = ref({
  todayLearned: 0,
  todayReviewed: 0,
  totalLearned: 0,
  totalDays: 0
});

// 日历相关
const showCalendar = ref(true); // 控制日历显示
const currentDate = ref([dayjs().format('YYYY-MM-DD')]); // 当前选中的日期，默认今天（数组格式）
const signedDates = ref(new Set()); // 已签到的日期集合

// 判断选中日期是否已签到
const isSelectedDateSigned = computed(() => {
  console.log('已签到日期集合:', signedDates.value);
  return signedDates.value.has(currentDate.value[0]);
});

// 判断选中日期是否是今天
const isSelectedDateToday = computed(() => {
  console.log('当前选中日期:', currentDate.value[0]);
  console.log('今天是:', dayjs().format('YYYY-MM-DD'));
  return currentDate.value[0] === dayjs().format('YYYY-MM-DD');
});

// 判断选中日期是否是未来日期
const isSelectedDateFuture = computed(() => {
  return dayjs(currentDate.value[0]).isAfter(dayjs(), 'day');
});

// 日历格式化函数 - 标记已签到的日期
const formatter = (day) => {
  const dateStr = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
  console.log('日期:', dateStr);
  //日期: undefined-04-30
  // 如果该日期已签到，显示"已签到"（橙色），否则显示"未签到"（灰色）
  if (signedDates.value.has(dateStr)) {
    day.bottomInfo = '已签到';
  } else {
    day.bottomInfo = '未签到';
    day.dot = true;
  }
  
  return day;
};

// 签到
const handleSignIn = async () => {
  if (isSelectedDateSigned.value || isSelectedDateFuture.value) {
    return;
  }
  
  uni.showLoading({ title: '签到中...' });
  
  try {
    // TODO: 调用后端签到接口
    // await callEntryCloud({
    //   action: 'signIn',
    //   date: currentDate.value[0]
    // });
    
    // 临时使用本地存储
    signedDates.value.add(currentDate.value[0]);
    
    // 更新统计数据
    statistics.value.totalDays += 1;
    
    uni.showToast({ title: '签到成功', icon: 'success' });
  } catch (error) {
    console.error('签到失败:', error);
    uni.showToast({ title: '签到失败', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

// 补签
const handleMakeupSignIn = async () => {
  if (isSelectedDateSigned.value || isSelectedDateToday.value || isSelectedDateFuture.value) {
    return;
  }
  
  uni.showModal({
    title: '提示',
    content: '确定要补签吗？',
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '补签中...' });
        
        try {
          // TODO: 调用后端补签接口
          // await callEntryCloud({
          //   action: 'makeupSignIn',
          //   date: currentDate.value[0]
          // });
          
          // 临时使用本地存储
          signedDates.value.add(currentDate.value[0]);
          
          // 更新统计数据
          statistics.value.totalDays += 1;
          
          uni.showToast({ title: '补签成功', icon: 'success' });
        } catch (error) {
          console.error('补签失败:', error);
          uni.showToast({ title: '补签失败', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      }
    }
  });
};

// 换本词书
const handleChangeBook = () => {
  uni.showToast({
    title: '换本词书功能开发中',
    icon: 'none'
  });
  // TODO: 跳转到词书选择页面
  // uni.navigateTo({
  //   url: '/pages/book-list/index'
  // });
};

// 获取用户统计数据
const fetchStatistics = async () => {
  try {
    // TODO: 调用后端接口获取真实数据
    // const res = await callEntryCloud({ action: 'getUserStatistics' });
    
    // 临时使用模拟数据
    statistics.value = {
      todayLearned: 25,
      todayReviewed: 10,
      totalLearned: 156,
      totalDays: 12
    };
    
    // 获取已签到日期列表
    // const signedRes = await callEntryCloud({ action: 'getSignedDates' });
    // signedDates.value = new Set(signedRes?.data?.dates || []);
    
    // 临时使用模拟的签到数据
    const today = dayjs();
    for (let i = 0; i < 12; i++) {
      const date = today.subtract(i, 'day').format('YYYY-MM-DD');
      signedDates.value.add(date);
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
  }
};

// 日历确认事件
const onCalendarConfirm = (date) => {
  console.log('日历选中日期:', date);
  // 如果需要在这里更新 currentDate，v-model 通常会自动处理
  // 可以在这里添加额外的业务逻辑
  console.log('之前的日期:', currentDate.value);
  currentDate.value = date;
  console.log('新的日期:', currentDate.value);
};

// 页面加载时设置 formatter（兼容微信小程序）
onReady(() => {
  if (calendarRef.value && calendarRef.value.setFormatter) {
    calendarRef.value.setFormatter(formatter);
  }
});

// 页面显示时刷新数据
onShow(async () => {
  await fetchStatistics();
});
</script>

<template>
  <view class="dash-board-box">
    <TopNav title="仪表盘" />
    
    <view class="content">
      <!-- 在学词书区域 -->
      <view class="section learning-book">
        <view class="section-header">
          <view class="section-title">在学词书</view>
          <view class="change-book-btn" @click="handleChangeBook">
            <text class="btn-text">换本词书</text>
          </view>
        </view>
        
        <view class="white-card">
          <!-- 词书卡片 -->
          <view class="book-card" :style="{ background: currentBook.cover || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }">
            <view class="book-info">
              <text class="book-title">{{ currentBook.title }}</text>
              <text class="book-desc">{{ currentBook.desc }}</text>
            </view>
          </view>
          
          <!-- 学习进度和数据 -->
          <view class="progress-section">
            <view class="progress-bar-bg">
              <view class="progress-bar-fill" :style="{ width: learnProgress + '%' }"></view>
            </view>
            <view class="progress-data">
              <text class="data-item">已学 {{ currentBook.learnedCount }}</text>
              <text class="data-item">总词数 {{ currentBook.totalCount }}</text>
            </view>
          </view>
        </view>
      </view>
      
      <!-- 我的数据区域 -->
      <view class="section my-data">
        <view class="section-title">我的数据</view>
        
        <!-- 数据统计 -->
        <view class="white-card">
          <view class="stats-grid">
            <view class="stat-item">
              <text class="stat-title">今日学习词</text>
              <text class="stat-value">{{ statistics.todayLearned }}词</text>
            </view>
            <view class="stat-item">
              <text class="stat-title">今日复习词</text>
              <text class="stat-value">{{ statistics.todayReviewed }}词</text>
            </view>
            <view class="stat-item">
              <text class="stat-title">累计学习词</text>
              <text class="stat-value">{{ statistics.totalLearned }}词</text>
            </view>
            <view class="stat-item">
              <text class="stat-title">累计学习天数</text>
              <text class="stat-value">{{ statistics.totalDays }}天</text>
            </view>
          </view>
        </view>
        
        <!-- 日历 -->
        <view class="white-card calendar-card">
          <up-calendar 
            ref="calendarRef"
            :show="showCalendar"
            :showTitle="false"
            mode="single"
            :pageInline="true"
            monthNum="6"
            :min-date="dayjs().subtract(5, 'month').format('YYYY-MM-DD')"
            :max-date="dayjs().format('YYYY-MM-DD')"
            :defaultDate="dayjs().format('YYYY-MM-DD')"
            v-model="currentDate"
            :show-confirm="false"
            @confirm="onCalendarConfirm"
          />
          
          <!-- 按钮区 -->
          <view class="calendar-actions">
            <view v-if="!isSelectedDateSigned && !isSelectedDateToday && !isSelectedDateFuture" class="action-btn makeup-btn" @click="handleMakeupSignIn">
              补签
            </view>
            <view v-else-if="!isSelectedDateSigned && isSelectedDateToday" class="action-btn signin-btn" @click="handleSignIn">
              签到
            </view>
          </view>
        </view>
      </view>
    </view>

    <u-safe-bottom />
  </view>
</template>

<style scoped lang="scss">
.dash-board-box {
  height: 100vh;
  max-height: 100vh;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  padding: 20rpx;
  overflow-y: auto;
}

.section {
  margin-bottom: 30rpx;
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
    padding-left: 10rpx;
  }
  
  .section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
  }
  
  .change-book-btn {
    padding: 8rpx 20rpx;
    background-color: #fff;
    border: 2rpx solid #ff9a56;
    border-radius: 30rpx;
    
    .btn-text {
      font-size: 24rpx;
      color: #ff9a56;
    }
  }
}

.white-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

// 在学词书样式
.learning-book {
  .book-card {
    // width: 500rpx;
    width: auto;
    height: 200rpx;
    padding: 20rpx;
    border-radius: 12rpx;
    margin-bottom: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .book-info {
      text-align: center;
      color: #fff;
      
      .book-title {
        display: block;
        font-size: 36rpx;
        font-weight: bold;
        margin-bottom: 10rpx;
      }
      
      .book-desc {
        display: block;
        font-size: 24rpx;
        opacity: 0.9;
      }
    }
  }
  
  .progress-section {
    .progress-bar-bg {
      width: 100%;
      height: 16rpx;
      background-color: #e5e5e5;
      border-radius: 8rpx;
      overflow: hidden;
      margin-bottom: 16rpx;
      
      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #ff9a56 0%, #ff6b35 100%);
        border-radius: 8rpx;
        transition: width 0.3s ease;
      }
    }
    
    .progress-data {
      display: flex;
      justify-content: space-between;
      
      .data-item {
        font-size: 26rpx;
        color: #666;
      }
    }
  }
}

// 我的数据样式
.my-data {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24rpx;
    
    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20rpx;
      background-color: #fafafa;
      border-radius: 12rpx;
      
      .stat-title {
        font-size: 24rpx;
        color: #999;
        margin-bottom: 10rpx;
      }
      
      .stat-value {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
      }
    }
  }
  
  .calendar-card {
    padding: 0;
    overflow: hidden;
    
    .calendar-actions {
      padding: 20rpx;
      border-top: 1rpx solid #f0f0f0;
      
      .action-btn {
        padding: 20rpx 0;
        text-align: center;
        border-radius: 50rpx;
        font-size: 28rpx;
        font-weight: 500;
        
        &.signin-btn {
          background: linear-gradient(135deg, #ff9a56 0%, #ff6b35 100%);
          color: #fff;
        }
        
        &.makeup-btn {
          background-color: #fff;
          color: #ff6b35;
          border: 2rpx solid #ff6b35;
        }
      }
    }
  }
}
</style>
