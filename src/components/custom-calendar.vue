<template>
  <view class="custom-calendar">
    <!-- 月份标题 -->
    <view class="calendar-header" v-if="months.length > 0">
      <text class="month-title">{{ months[currentMonthIndex].year }}年{{ months[currentMonthIndex].month }}月</text>
    </view>
    
    <!-- 星期标题 -->
    <view class="week-header">
      <view class="week-item" v-for="(week, index) in weekDays" :key="index">
        <text class="week-text">{{ week }}</text>
      </view>
    </view>
    
    <!-- 月份滑动容器 -->
    <swiper 
      class="month-swiper" 
      :current="currentMonthIndex" 
      @change="onMonthChange"
      :circular="false"
      :duration="300"
    >
      <swiper-item v-for="(month, monthIndex) in months" :key="monthIndex">
        <view class="month-grid">
          <!-- 空白占位（月初前的空白天数） -->
          <view 
            class="day-cell empty" 
            v-for="n in month.firstDayWeek" 
            :key="'empty-' + n"
          ></view>
          
          <!-- 日期单元格 -->
          <view 
            class="day-cell"
            :class="{
              'signed': day.signed,
              'unsigned': !day.signed && !day.disabled,
              'disabled': day.disabled,
              'today': isToday(day.date),
              'selected': isSelected(day.date)
            }"
            v-for="(day, dayIndex) in month.days" 
            :key="dayIndex"
            @click="handleDayClick(day)"
          >
            <text class="day-number">{{ day.day }}</text>
            <text class="day-status" v-if="!day.disabled">{{ day.signed ? '已签到' : '未签到' }}</text>
          </view>
        </view>
      </swiper-item>
    </swiper>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import dayjs from 'dayjs';

const props = defineProps({
  // 有效期范围
  minDate: {
    type: String,
    required: true
  },
  maxDate: {
    type: String,
    required: true
  },
  // 已签到日期列表
  signedDates: {
    type: Set,
    default: () => new Set()
  },
  // 当前选中的日期
  currentDate: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['dayClick', 'monthChange']);

// 星期标题
const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

// 当前月份索引
const currentMonthIndex = ref(0);

// 生成月份列表
const months = computed(() => {
  if (!props.minDate || !props.maxDate) {
    return [];
  }
  
  const result = [];
  let current = dayjs(props.minDate).startOf('month');
  const end = dayjs(props.maxDate);
  
  while (current.isBefore(end) || current.isSame(end, 'month')) {
    const year = current.year();
    const month = current.month() + 1;
    
    // 生成该月的所有日期
    const daysInMonth = current.daysInMonth();
    const days = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = dayjs(dateStr);
      
      days.push({
        day,
        week: dateObj.day(), // 0-6，0是周日
        date: dateStr,
        signed: props.signedDates.has(dateStr),
        disabled: dateObj.isBefore(dayjs(props.minDate)) || dateObj.isAfter(dayjs(props.maxDate)),
        isToday: dateObj.isSame(dayjs(), 'day')
      });
    }
    
    result.push({
      year,
      month,
      days,
      firstDayWeek: current.day() // 该月第一天是星期几（0-6）
    });
    
    current = current.add(1, 'month');
  }
  
  return result;
});

// 判断是否是今天
const isToday = (dateStr) => {
  return dayjs(dateStr).isSame(dayjs(), 'day');
};

// 判断是否是选中的日期
const isSelected = (dateStr) => {
  return props.currentDate && dayjs(dateStr).isSame(dayjs(props.currentDate), 'day');
};

// 月份切换事件
const onMonthChange = (e) => {
  currentMonthIndex.value = e.detail.current;
  emit('monthChange', {
    index: currentMonthIndex.value,
    ...months.value[currentMonthIndex.value]
  });
};

// 日期点击事件
const handleDayClick = (day) => {
  if (day.disabled) {
    return;
  }
  emit('dayClick', day);
};

// 监听有效期范围变化，重置当前月份索引
watch(() => [props.minDate, props.maxDate], () => {
  currentMonthIndex.value = 0;
}, { immediate: false });
</script>

<style scoped lang="scss">
.custom-calendar {
  width: 100%;
  
  .calendar-header {
    padding: 20rpx 0;
    text-align: center;
    
    .month-title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
    }
  }
  
  .week-header {
    display: flex;
    border-bottom: 1rpx solid #f0f0f0;
    
    .week-item {
      flex: 1;
      padding: 16rpx 0;
      text-align: center;
      
      .week-text {
        font-size: 24rpx;
        color: #999;
      }
    }
  }
  
  .month-swiper {
    height: 500rpx;
    
    .month-grid {
      display: flex;
      flex-wrap: wrap;
      padding: 10rpx 0;
      
      .day-cell {
        width: 14.28%; // 7列，每列占 1/7
        height: 80rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        
        &.empty {
          // 空白占位，不显示任何内容
        }
        
        &.signed {
          background-color: #e8f5e9;  // 绿色背景 - 已签到
          
          .day-number {
            color: #4caf50;
            font-weight: bold;
          }
          
          .day-status {
            color: #4caf50;
            font-size: 18rpx;
          }
        }
        
        &.unsigned {
          .day-number {
            color: #333;
          }
          
          .day-status {
            color: #999;
            font-size: 18rpx;
          }
        }
        
        &.disabled {
          .day-number {
            color: #ccc;
          }
        }
        
        &.today {
          background-color: #e3f2fd;  // 蓝色背景 - 今天
          
          .day-number {
            color: #2196f3;
            font-weight: bold;
          }
        }
        
        &.selected {
          background-color: #fff3e0;  // 橙色背景 - 选中
          // border: 2rpx solid #ff9800;
          border-radius: 8rpx;
          transform: scale(1.05);
          box-shadow: 0 2rpx 8rpx rgba(255, 152, 0, 0.3);
          
          .day-number {
            color: #ff9800;
            font-weight: bold;
            font-size: 32rpx;
          }
          
          .day-status {
            color: #ff9800;
            font-weight: bold;
          }
        }
        
        .day-number {
          font-size: 28rpx;
          margin-bottom: 4rpx;
        }
        
        .day-status {
          font-size: 18rpx;
        }
      }
    }
  }
}
</style>
