<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import dayjs from 'dayjs';
import TopNav from '@/components/top-nav.vue';
import CustomCalendar from '@/components/custom-calendar.vue';
import { useUserStore } from '@/stores/user';
import { callEntryCloud } from '@/utils/wx-cloud-call';

const userStore = useUserStore();

// 模拟数据 - 在学词书（将从后端获取）
const currentBook = ref(null); // null 表示未选择词书

// 学习进度计算
const learnProgress = computed(() => {
  if (!currentBook.value || !currentBook.value.totalCount) return 0;
  return Math.round((currentBook.value.learnedCount / currentBook.value.totalCount) * 100);
});

// 词书选择弹窗相关
const showBookPicker = ref(false); // 控制词书选择弹窗显示
const bookList = ref([]); // 词书列表

// 统计数据
const statistics = ref({
  todayLearned: 0,
  todayReviewed: 0,
  totalLearned: 0,
  totalDays: 0
});

// 日历相关
const currentDate = ref(dayjs().format('YYYY-MM-DD')); // 当前选中的日期，默认今天（字符串格式）
const signedDates = ref(new Set()); // 已签到的日期集合 (数据源完全来自后端)
const calendarRange = ref({
  minDate: '', // 默认空，等待后端返回
  maxDate: ''  // 默认空，等待后端返回
}); // 日历有效期范围（从后端获取）

// 判断选中日期是否已签到
const isSelectedDateSigned = computed(() => {
  return signedDates.value.has(currentDate.value);
});

// 判断选中日期是否是今天
const isSelectedDateToday = computed(() => {
  return currentDate.value === dayjs().format('YYYY-MM-DD');
});

// 判断选中日期是否是未来日期
const isSelectedDateFuture = computed(() => {
  return dayjs(currentDate.value).isAfter(dayjs(), 'day');
});

// 日历日期点击事件
const handleDayClick = (day) => {
  console.log('点击日期:', day);
  currentDate.value = day.date;
};

// 日历月份切换事件
const handleMonthChange = (monthData) => {
  console.log('切换到月份:', monthData.year, '年', monthData.month, '月');
};

// 签到
const handleSignIn = async () => {
  if (isSelectedDateSigned.value || isSelectedDateFuture.value) {
    return;
  }
  
  uni.showLoading({ title: '签到中...' });
  
  try {
    // 调用后端签到接口
    const res = await callEntryCloud({
      action: 'signIn',
      date: currentDate.value
    });
    const result = res?.result || {};
    
    console.log('签到接口返回:', result); // ✅ 添加调试日志
    
    if (result.code === 0) {
      // ✅ 关键修改：不操作本地 Set，而是重新从云端拉取最新数据
      // 这样可以保证多端同步，且状态绝对准确
      await fetchStatistics();
      
      uni.showToast({ title: '签到成功', icon: 'success' });
    } else {
      // 处理错误
      if (result.code === 409) {
        // 即使报错也刷新一下，防止本地状态滞后
        console.warn('收到409错误，重新同步数据');
        await fetchStatistics();
        uni.showToast({ title: '该日期已签到', icon: 'none' });
      } else {
        uni.showToast({ title: result.message || '签到失败', icon: 'none' });
      }
    }
  } catch (error) {
    console.error('签到异常:', error);
    uni.showToast({ title: '网络错误', icon: 'none' });
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
          // 调用后端补签接口
          const result_res = await callEntryCloud({
            action: 'makeupSignIn',
            date: currentDate.value
          });
          const result = result_res?.result || {};
          
          if (result.code === 0) {
            // ✅ 关键修改：重新从云端拉取最新数据
            await fetchStatistics();
            
            uni.showToast({ title: '补签成功', icon: 'success' });
          } else {
            // 处理错误
            if (result.code === 409) {
              await fetchStatistics();
              uni.showToast({ title: '该日期已签到', icon: 'none' });
            } else {
              uni.showToast({ title: result.message || '补签失败', icon: 'none' });
            }
          }
        } catch (error) {
          console.error('补签异常:', error);
          uni.showToast({ title: '网络错误', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      }
    }
  });
};

// 换本词书
const handleChangeBook = () => {
  openBookPicker();
};

// 获取用户统计数据 (核心数据同步函数)
const fetchStatistics = async () => {
  uni.showLoading({ title: '加载中...' });
  try {
    // 1. 并行请求所有数据，提高加载速度
    const [statsRes, signedRes, bookRes, bookListRes] = await Promise.all([
      callEntryCloud({ action: 'getUserStatistics' }),
      callEntryCloud({ action: 'getSignedDates' }),
      callEntryCloud({ action: 'getCurrentBook' }),
      callEntryCloud({ action: 'getBookList' })  // ✅ 同时获取词书列表
    ]);

    const statsResult = statsRes?.result || {};
    const signedResult = signedRes?.result || {};
    const bookResult = bookRes?.result || {};
    const bookListResult = bookListRes?.result || {};

    // 2. 处理学习统计
    if (statsResult.code === 0 && statsResult.data) {
      statistics.value = {
        todayLearned: statsResult.data.todayLearned || 0,
        todayReviewed: statsResult.data.todayReviewed || 0,
        totalLearned: statsResult.data.totalLearned || 0,
        totalDays: statsResult.data.totalDays || 0
      };
    } else {
      console.error('获取统计数据失败:', statsResult.message);
    }
    
    // 3. 处理已签到日期和有效期 (关键：完全由后端控制)
    if (signedResult.code === 0 && signedResult.data) {
      // 将后端返回的数组转换为 Set，用于快速查找
      signedDates.value = new Set(signedResult.data.dates || []);
      
      // ✅ 更新有效期范围（即使 dates 为空数组，也要更新范围）
      if (signedResult.data.minDate && signedResult.data.maxDate) {
        calendarRange.value = {
          minDate: signedResult.data.minDate,
          maxDate: signedResult.data.maxDate
        };
        
        console.log('云端数据同步完成:', {
          已签到数量: signedDates.value.size,
          有效期范围: `${calendarRange.value.minDate} ~ ${calendarRange.value.maxDate}`,
          签到列表: Array.from(signedDates.value)
        });
      }
    } else {
      signedDates.value = new Set(); // 失败或无数据时清空
      console.error('获取已签到日期失败:', signedResult.message);
    }
    
    // 4. 处理词书信息
    if (bookResult.code === 0 && bookResult.data) {
      // ✅ 从后端返回的词书列表中查找封面颜色
      const books = bookListResult.data?.books || [];
      const bookInfo = books.find(book => book.book_id === bookResult.data.book_id);
      
      currentBook.value = {
        id: bookResult.data.book_id,
        title: bookResult.data.book_name,
        desc: bookResult.data.book_desc,
        cover: bookInfo?.cover_color || '', // 使用后端返回的封面颜色
        learnedCount: bookResult.data.learned_count || 0,
        totalCount: bookResult.data.total_count || 0
      };
      console.log('当前词书:', currentBook.value);
    } else {
      // 没有选择词书，保持 null
      currentBook.value = null;
      console.log('未选择词书');
    }

  } catch (error) {
    console.error('获取数据异常:', error);
    uni.showToast({ title: '数据同步失败', icon: 'none' });
  }
  finally {
    uni.hideLoading();
  }
};

// 打开词书选择弹窗
const openBookPicker = async () => {
  showBookPicker.value = true;
  
  // ✅ 每次都从后端获取最新的词书列表
  uni.showLoading({ title: '加载中...' });
  
  try {
    const res = await callEntryCloud({ action: 'getBookList' });
    const result = res?.result || {};
    
    if (result.code === 0 && result.data?.books) {
      bookList.value = result.data.books;
      console.log('词书列表:', bookList.value);
    } else {
      uni.showToast({ title: result.message || '获取词书列表失败', icon: 'none' });
    }
  } catch (error) {
    console.error('获取词书列表异常:', error);
    uni.showToast({ title: '网络错误', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

// 关闭词书选择弹窗
const closeBookPicker = () => {
  showBookPicker.value = false;
};

// 确认选择词书
const confirmBookSelection = async (book) => {
  uni.showLoading({ title: '设置中...' });
  console.log('选择的词书:', book);
  
  try {
    const res = await callEntryCloud({
      action: 'setCurrentBook',
      book_id: book.book_id
    });
    const result = res?.result || {};
    
    if (result.code === 0) {
      // ✅ 使用后端返回的词书信息（已包含封面颜色）
      currentBook.value = {
        id: book.book_id,
        title: book.book_name,
        desc: book.book_desc,
        cover: book.cover_color || '',  // 直接使用后端返回的封面颜色
        learnedCount: 0, // 新词书进度为 0
        totalCount: book.total_count
      };
      
      // 关闭弹窗
      showBookPicker.value = false;
      
      uni.showToast({ title: '词书设置成功', icon: 'success' });
      
      // ✅ 重新获取统计数据，确保数据同步
      await fetchStatistics();
    } else {
      uni.showToast({ title: result.message || '设置失败', icon: 'none' });
    }
  } catch (error) {
    console.error('设置词书异常:', error);
    uni.showToast({ title: '设置失败', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

// 日历确认事件
const onCalendarConfirm = (date) => {
  console.log('日历选中日期:', date);
  if (typeof date === 'string') {
    currentDate.value = date;
  }
  console.log('当前选中日期:', currentDate.value);
};

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
          <view v-if="currentBook" class="book-card" :style="{ background: currentBook.cover || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }">
            <view class="book-info">
              <text class="book-title">{{ currentBook.title }}</text>
              <text class="book-desc">{{ currentBook.desc }}</text>
            </view>
          </view>
          
          <!-- 未选择词书提示 -->
          <view v-else class="no-book-tip">
            <text class="tip-text">还未选择词书</text>
            <view class="select-book-btn" @click="openBookPicker">
              <text class="btn-text">立即选择</text>
            </view>
          </view>
          
          <!-- 学习进度和数据 -->
          <view v-if="currentBook" class="progress-section">
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
          <!-- ✅ 使用自定义日历组件 -->
          <CustomCalendar
            v-if="calendarRange.minDate && calendarRange.maxDate"
            :minDate="calendarRange.minDate"
            :maxDate="calendarRange.maxDate"
            :signedDates="signedDates"
            :currentDate="currentDate"
            @dayClick="handleDayClick"
            @monthChange="handleMonthChange"
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

  <!-- 词书选择弹窗 -->
  <up-popup 
    v-model:show="showBookPicker" 
    mode="bottom" 
    :round="20"
    :safeAreaInsetBottom="true"
  >
    <view class="book-picker-popup">
      <!-- 标题栏 -->
      <view class="popup-header">
        <text class="popup-title">选择词书</text>
        <view class="close-btn" @click="closeBookPicker">
          <u-icon name="close" size="20" color="#999"></u-icon>
        </view>
      </view>
      
      <!-- 内容区 - 词书列表 -->
      <scroll-view scroll-y class="popup-content">
        <view 
          v-for="(book, index) in bookList" 
          :key="index"
          class="book-item"
          @click="confirmBookSelection(book)"
        >
          <view class="book-cover" :style="{ background: book.cover_color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }">
            <view class="book-info-overlay">
              <text class="book-name">{{ book.book_name || '未知词书' }}</text>
              <text class="book-description">{{ book.book_desc || '暂无描述' }}</text>
              <text class="book-total">总词数：{{ book.total_count  || 0 }}</text>
            </view>
          </view>
        </view>
        
        <!-- 空状态 -->
        <view v-if="bookList.length === 0" class="empty-state">
          <text class="empty-text">暂无词书</text>
        </view>
      </scroll-view>
      
      <!-- 底部确认按钮（可选，点击词书即确认） -->
      <!-- <view class="popup-footer">
        <view class="confirm-btn" @click="closeBookPicker">
          <text class="btn-text">取消</text>
        </view>
      </view> -->
    </view>
  </up-popup>
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
  
  .no-book-tip {
    padding: 60rpx 20rpx;
    text-align: center;
    
    .tip-text {
      display: block;
      font-size: 28rpx;
      color: #999;
      margin-bottom: 24rpx;
    }
    
    .select-book-btn {
      display: inline-block;
      padding: 16rpx 40rpx;
      background: linear-gradient(135deg, #ff9a56 0%, #ff6b35 100%);
      border-radius: 50rpx;
      
      .btn-text {
        font-size: 28rpx;
        color: #fff;
        font-weight: 500;
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

// 词书选择弹窗样式
.book-picker-popup {
  height: 60vh;
  display: flex;
  flex-direction: column;
  
  .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 30rpx;
    border-bottom: 1rpx solid #f0f0f0;
    
    .popup-title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
    }
    
    .close-btn {
      padding: 10rpx;
    }
  }
  
  .popup-content {
    flex: 1;
    overflow-y: auto;
    padding: 20rpx;
    box-sizing: border-box;
    
    .book-item {
      margin-bottom: 20rpx;
      border-radius: 16rpx;
      overflow: hidden;
      box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
      transition: transform 0.2s ease;
      
      &:active {
        transform: scale(0.98);
      }
      
      .book-cover {
        min-height: 200rpx;
        padding: 30rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        
        .book-info-overlay {
          text-align: center;
          color: #fff;
          
          .book-name {
            display: block;
            font-size: 36rpx;
            font-weight: bold;
            margin-bottom: 12rpx;
          }
          
          .book-description {
            display: block;
            font-size: 24rpx;
            opacity: 0.9;
            margin-bottom: 8rpx;
          }
          
          .book-total {
            display: block;
            font-size: 22rpx;
            opacity: 0.8;
          }
        }
      }
    }
    
    .empty-state {
      padding: 100rpx 0;
      text-align: center;
      
      .empty-text {
        font-size: 28rpx;
        color: #999;
      }
    }
  }
  
  .popup-footer {
    padding: 20rpx 30rpx;
    border-top: 1rpx solid #f0f0f0;
    
    .confirm-btn {
      padding: 24rpx 0;
      text-align: center;
      background-color: #f5f5f5;
      border-radius: 50rpx;
      
      .btn-text {
        font-size: 28rpx;
        color: #666;
      }
    }
  }
}
</style>