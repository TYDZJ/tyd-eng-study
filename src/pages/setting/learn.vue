<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import TopNav from '@/components/top-nav.vue';
import { callEntryCloud } from '@/utils/wx-cloud-call';

// 新学单词首次复习时间选项
const reviewTimeOptions = [
  { label: '全部次日复习', value: 'all_next_day' },
  { label: '错词次日复习', value: 'wrong_next_day' }
];

// 每组单词数量选项（5-20，步长5）
const wordCountOptions = [
  { label: '5个', value: 5 },
  { label: '10个', value: 10 },
  { label: '15个', value: 15 },
  { label: '20个', value: 20 }
];

// 学习模式选项
const learningModes = [
  { 
    icon: '📚', 
    title: '丰富模式', 
    desc: '显示音标、释义、例句等完整信息',
    value: 'rich'
  },
  { 
    icon: '✨', 
    title: '简洁模式', 
    desc: '仅显示核心内容，快速刷词',
    value: 'simple'
  }
];

// 当前选中的值
const reviewTime = ref('all_next_day'); // 默认全部次日复习
const learnCount = ref(10); // 默认每组10个
const reviewCount = ref(10); // 默认每组复习10个
const learningMode = ref('rich'); // 默认丰富模式

// 选择器状态
const showModePopup = ref(false);

// 页面加载时获取用户设置
onShow(async () => {
  uni.showLoading({
    title: '加载中...'
  });
  await fetchUserSettings();
  uni.hideLoading();
});

// 从本地存储加载设置
const loadFromLocalStorage = () => {
  try {
    const savedSettings = uni.getStorageSync('user_learning_settings');
    if (savedSettings) {
      reviewTime.value = savedSettings.review_time || 'all_next_day';
      learnCount.value = savedSettings.learn_count || 10;
      reviewCount.value = savedSettings.review_count || 10;
      learningMode.value = savedSettings.learning_mode || 'rich';
    }
  } catch (error) {
    console.error('读取本地存储失败:', error);
  }
};

// 保存到本地存储
const saveToLocalStorage = () => {
  try {
    uni.setStorageSync('user_learning_settings', {
      review_time: reviewTime.value,
      learn_count: learnCount.value,
      review_count: reviewCount.value,
      learning_mode: learningMode.value
    });
  } catch (error) {
    console.error('保存到本地存储失败:', error);
  }
};

// 获取用户学习设置
const fetchUserSettings = async () => {
  try {
    const res = await callEntryCloud({
      action: "getUserSettings"
    });
    
    const result = res?.result;
    
    if (result && result.code === 0 && result.data) {
      const settings = result.data.settings || {};
      reviewTime.value = settings.review_time || 'all_next_day';
      learnCount.value = settings.learn_count || 10;
      reviewCount.value = settings.review_count || 10;
      learningMode.value = settings.learning_mode || 'rich';
    } else {
      // 如果后端没有数据，尝试从本地存储读取
      loadFromLocalStorage();
    }
  } catch (error) {
    console.error('获取学习设置失败:', error);
    // 使用本地存储作为降级方案
    loadFromLocalStorage();
  }
};

// 保存设置
const saveSettings = async () => {
  // 先保存到本地存储，确保即时生效
  saveToLocalStorage();
  
  uni.showLoading({
    title: '保存中...'
  });
  
  try {
    const res = await callEntryCloud({
      action: "updateUserSettings",
      settings: {
        review_time: reviewTime.value,
        learn_count: learnCount.value,
        review_count: reviewCount.value,
        learning_mode: learningMode.value
      }
    });
    
    const result = res?.result;
    
    if (result && result.code === 0) {
      uni.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1000
      });
    } else {
      // 云端保存失败，但本地已保存，静默处理
      console.warn('云端保存失败，但本地已保存:', result?.message);
    }
  } catch (error) {
    console.error('保存设置失败:', error);
    // 云端保存失败不影响使用，因为本地已保存
  } finally {
    uni.hideLoading();
  }
};

// 选择学习模式
const selectLearningMode = (value) => {
  learningMode.value = value;
  showModePopup.value = false;
  saveSettings();
};

// 获取显示文本
const getReviewTimeText = () => {
  const option = reviewTimeOptions.find(opt => opt.value === reviewTime.value);
  return option ? option.label : '';
};

const getCountText = (count) => {
  return `${count}个`;
};

const getModeText = () => {
  const mode = learningModes.find(m => m.value === learningMode.value);
  return mode ? mode.title : '';
};

// 计算属性：选择器的选项数组（用于uni原生picker）
const reviewTimeRange = computed(() => reviewTimeOptions.map(opt => opt.label));
const wordCountRange = computed(() => wordCountOptions.map(opt => opt.label));

// 当前选中的索引
const reviewTimeIndex = computed(() => {
  return reviewTimeOptions.findIndex(opt => opt.value === reviewTime.value);
});

const learnCountIndex = computed(() => {
  return wordCountOptions.findIndex(opt => opt.value === learnCount.value);
});

const reviewCountIndex = computed(() => {
  return wordCountOptions.findIndex(opt => opt.value === reviewCount.value);
});

// 处理复习时间选择
const onReviewTimeChange = (e) => {
  const index = e.detail.value;
  reviewTime.value = reviewTimeOptions[index].value;
  saveSettings();
};

// 处理学习数量选择
const onLearnCountChange = (e) => {
  const index = e.detail.value;
  learnCount.value = wordCountOptions[index].value;
  saveSettings();
};

// 处理复习数量选择
const onReviewCountChange = (e) => {
  const index = e.detail.value;
  reviewCount.value = wordCountOptions[index].value;
  saveSettings();
};
</script>

<template>
  <view class="setting-box">
    <top-nav title="学习设置" />
    
    <view class="setting-content">
      <!-- 新学单词首次复习时间 -->
      <picker 
        :range="reviewTimeRange" 
        :value="reviewTimeIndex"
        @change="onReviewTimeChange"
      >
        <view class="setting-card">
          <view class="card-row">
            <text class="card-label">新学单词首次复习时间</text>
            <view class="card-value-wrapper">
              <text class="card-value">{{ getReviewTimeText() }}</text>
              <u-icon name="arrow-right" size="14" color="#999"></u-icon>
            </view>
          </view>
        </view>
      </picker>
      
      <!-- 每组单词学习量 -->
      <picker 
        :range="wordCountRange" 
        :value="learnCountIndex"
        @change="onLearnCountChange"
      >
        <view class="setting-card">
          <view class="card-row">
            <text class="card-label">每组单词学习量</text>
            <view class="card-value-wrapper">
              <text class="card-value">{{ getCountText(learnCount) }}</text>
              <u-icon name="arrow-right" size="14" color="#999"></u-icon>
            </view>
          </view>
        </view>
      </picker>
      
      <!-- 每组单词复习量 -->
      <picker 
        :range="wordCountRange" 
        :value="reviewCountIndex"
        @change="onReviewCountChange"
      >
        <view class="setting-card">
          <view class="card-row">
            <text class="card-label">每组单词复习量</text>
            <view class="card-value-wrapper">
              <text class="card-value">{{ getCountText(reviewCount) }}</text>
              <u-icon name="arrow-right" size="14" color="#999"></u-icon>
            </view>
          </view>
        </view>
      </picker>
      
      <!-- 学习模式 -->
      <view class="setting-card" @click="showModePopup = true">
        <view class="card-row">
          <text class="card-label">学习模式</text>
          <view class="card-value-wrapper">
            <text class="card-value">{{ getModeText() }}</text>
            <u-icon name="arrow-right" size="14" color="#999"></u-icon>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 学习模式弹窗 -->
    <u-popup v-model:show="showModePopup" mode="bottom" round="16">
      <view class="mode-popup">
        <view class="popup-header">
          <text class="popup-title">选择学习模式</text>
          <u-icon name="close" size="20" color="#999" @click="showModePopup = false"></u-icon>
        </view>
        
        <view class="mode-list">
          <view 
            v-for="mode in learningModes" 
            :key="mode.value"
            class="mode-item"
            :class="{ active: learningMode === mode.value }"
            @click="selectLearningMode(mode.value)"
          >
            <view class="mode-icon">{{ mode.icon }}</view>
            <view class="mode-info">
              <text class="mode-title">{{ mode.title }}</text>
              <text class="mode-desc">{{ mode.desc }}</text>
            </view>
            <view v-if="learningMode === mode.value" class="mode-check">
              <u-icon name="checkmark-circle-fill" size="24" color="#667eea"></u-icon>
            </view>
          </view>
        </view>
      </view>
    </u-popup>
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

// 设置卡片
.setting-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  
  .card-row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    
    .card-label {
      font-size: 30rpx;
      color: #333;
      flex: 1;
    }
    
    .card-value-wrapper {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10rpx;
      
      .card-value {
        font-size: 28rpx;
        color: #666;
      }
    }
  }
}

// 学习模式弹窗
.mode-popup {
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 30rpx;
  max-height: 70vh;
  
  .popup-header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30rpx;
    padding-bottom: 20rpx;
    border-bottom: 1rpx solid #f0f0f0;
    
    .popup-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
    }
  }
  
  .mode-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    
    .mode-item {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 30rpx;
      border-radius: 16rpx;
      border: 2rpx solid #f0f0f0;
      transition: all 0.3s ease;
      
      &.active {
        border-color: #667eea;
        background-color: rgba(102, 126, 234, 0.05);
      }
      
      &:active {
        opacity: 0.7;
      }
      
      .mode-icon {
        font-size: 48rpx;
        margin-right: 24rpx;
      }
      
      .mode-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8rpx;
        
        .mode-title {
          font-size: 30rpx;
          font-weight: 600;
          color: #333;
        }
        
        .mode-desc {
          font-size: 24rpx;
          color: #999;
          line-height: 1.5;
        }
      }
      
      .mode-check {
        margin-left: 20rpx;
      }
    }
  }
}
</style>
