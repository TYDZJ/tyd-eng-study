<script setup>
import { ref, computed } from 'vue'

// 模拟数据
const wordList = ref([
  { cn: '苹果', en: 'apple', passed: false },
  { cn: '香蕉', en: 'banana', passed: false },
  { cn: '橙子', en: 'orange', passed: false },
  { cn: '葡萄', en: 'grape', passed: false },
  { cn: '西瓜', en: 'watermelon', passed: false },
  // { cn: '苹果', en: 'apple', passed: false },
  // { cn: '香蕉', en: 'banana', passed: false },
  // { cn: '橙子', en: 'orange', passed: false },
  // { cn: '葡萄', en: 'grape', passed: false },
  // { cn: '西瓜', en: 'watermelon', passed: false },
  // { cn: '苹果', en: 'apple', passed: false },
  // { cn: '香蕉', en: 'banana', passed: false },
  // { cn: '橙子', en: 'orange', passed: false },
  // { cn: '葡萄', en: 'grape', passed: false },
  // { cn: '西瓜', en: 'watermelon', passed: false },
  // { cn: '苹果', en: 'apple', passed: false },
  // { cn: '香蕉', en: 'banana', passed: false },
  // { cn: '橙子', en: 'orange', passed: false },
  // { cn: '葡萄', en: 'grape', passed: false },
  // { cn: '西瓜', en: 'watermelon', passed: false },
])

// 当前轮播索引
const currentIndex = ref(0)

// 用户输入
const userInput = ref('')

// 是否为第一次尝试（每次切换轮播重置）
const isFirstAttempt = ref(true)

// 是否已显示对比结果
const showResult = ref(false)

// 防止循环触发的标志位
const isProgrammaticChange = ref(false)

// 获取当前单词
const currentWord = computed(() => wordList.value[currentIndex.value])

// 计算对比结果
const compareResult = computed(() => {
  if (!showResult.value || !userInput.value) return null
  
  const input = userInput.value.toLowerCase()
  const target = currentWord.value.en.toLowerCase()
  const result = []
  
  const maxLength = Math.max(input.length, target.length)
  
  for (let i = 0; i < maxLength; i++) {
    const inputChar = input[i] || ''
    const targetChar = target[i] || ''
    
    if (inputChar === targetChar) {
      result.push({ char: inputChar, status: 'correct' })
    } else {
      if (inputChar) {
        result.push({ char: inputChar, status: 'wrong' })
      }
      if (targetChar && !inputChar) {
        result.push({ char: targetChar, status: 'missing' })
      }
    }
  }
  
  return result
})

// 判断是否完全正确
const isCorrect = computed(() => {
  if (!compareResult.value) return false
  return userInput.value.toLowerCase() === currentWord.value.en.toLowerCase()
})

// 处理确认或重试按钮点击
const handleConfirmOrRetry = () => {
  // 如果是重试，重置状态
  if (showResult.value && !isCorrect.value) {
    resetState()
    return
  }
  
  // 否则执行确认逻辑
  handleConfirm()
}

// 处理确认按钮点击
const handleConfirm = () => {
  if (!userInput.value.trim()) {
    uni.showToast({
      title: '请输入英文单词',
      icon: 'none'
    })
    return
  }
  
  showResult.value = true
  
  // 如果是第一次且拼写正确，标记为通过
  if (isFirstAttempt.value && isCorrect.value) {
    currentWord.value.passed = true
  }
}

// 切换到下一个单词（点击按钮）
const handleNext = () => {
  // 查找下一个未通过的单词
  goNextUnpassed('forward')
}

// 切换到上一个单词（手动左滑）
const handlePrev = () => {
  // 查找上一个未通过的单词
  goNextUnpassed('backward')
}

// 重置状态
const resetState = () => {
  userInput.value = ''
  showResult.value = false
  isFirstAttempt.value = true
}

// 监听轮播变化（手动左右滑动）
const onSwiperChange = (e) => {
  // 如果是程序化触发的切换，不重复处理
  if (isProgrammaticChange.value) {
    isProgrammaticChange.value = false
    return
  }
  
  const newIndex = e.detail.current
  const oldIndex = currentIndex.value
  let targetIndex = -1

  if (!wordList.value[newIndex].passed){
    currentIndex.value = newIndex
  }else {
    // 判断滑动方向
    if (newIndex < oldIndex) {
      targetIndex = findBackwardIndex(newIndex)
    }else {
      targetIndex = findForwardIndex(newIndex)
    }
    // 如果找到目标索引，则切换到目标索引，否则保持在当前索引
    if (targetIndex !== -1) {
      currentIndex.value = targetIndex
    } else {
      currentIndex.value = newIndex
    }
  }
  
  resetState()
}

// 前往下一个未通过的单词的索引
const goNextUnpassed = (direction = 'forward') => {
  const startIndex = currentIndex.value
  let targetIndex = -1
  
  // 先查找后面的未通过单词
  if (direction === 'forward') targetIndex = findForwardIndex(startIndex)
  // 再查找前面的未通过单词
  if (targetIndex === -1) targetIndex = findFromStartIndex()
  
  if (targetIndex !== -1) {
    isProgrammaticChange.value = true
    currentIndex.value = targetIndex
    resetState()
  } else {
    uni.showToast({
      title: '没有未通过的单词了',
      icon: 'none'
    })
  }
}

// 从头开始获取未通过单词的索引
const findFromStartIndex = () => {
  for (let i = 0; i < wordList.value.length; i++) {
    if (!wordList.value[i].passed) {
      return i;
    }
  }
  return -1;
}
// 获取下一个未通过单词的索引
const findForwardIndex = (startIndex) => { 
  for (let i = startIndex + 1; i < wordList.value.length; i++) { 
    if (!wordList.value[i].passed) { 
      return i; 
    } 
  }
  return -1;
}
// 获取上一个未通过单词的索引
const findBackwardIndex = (startIndex) => { 
  for (let i = startIndex - 1; i >= 0; i--) {
    if (!wordList.value[i].passed) {
      return i;
    }
  }
  return -1;
}

// 处理自定义指示器点击
const handleIndicatorClick = (index) => {
  isProgrammaticChange.value = true
  currentIndex.value = index
  resetState()
}

</script>

<template>
  <view class="spell-box">
    <!-- 轮播图 -->
    <swiper 
      class="word-swiper" 
      :current="currentIndex"
      @change="onSwiperChange"
      :indicator-dots="false"
      :autoplay="false"
      :circular="true"
    >
      <swiper-item v-for="(word, index) in wordList" :key="index">
        <view class="word-content">
          <view class="text-box">
            <!-- 中文区 -->
            <view class="cn-box">
              <text class="cn-text">{{ word.cn }}</text>
              <!-- <text class="status-tag" :class="{ 'passed': word.passed }">
                {{ word.passed ? '✓ 已通过' : '未通过' }}
              </text> -->
            </view>

            <!-- 英文拼写区 -->
            <view class="en-box">
              <!-- 未通过状态：显示输入框或对比结果 -->
              <template v-if="!currentWord.passed">
                <!-- 输入框 -->
                <input 
                  v-if="!showResult"
                  v-model="userInput" 
                  class="en-input" 
                  type="text" 
                  placeholder="请输入英文单词"
                  @confirm="handleConfirm"
                />
                
                <!-- 对比结果（错误时显示在输入框位置） -->
                <view v-else-if="showResult && !isCorrect && compareResult" class="result-container">
                  <view class="result-box">
                    <text 
                      v-for="(item, idx) in compareResult" 
                      :key="idx"
                      class="result-char"
                      :class="item.status"
                    >
                      {{ item.char }}
                    </text>
                  </view>
                  <!-- 正确答案提示 -->
                  <view class="correct-answer">
                    <text class="answer-text">{{ currentWord.en }}</text>
                  </view>
                </view>
                
                <!-- 正确答案展示（正确时显示） -->
                <view v-else-if="showResult && isCorrect" class="correct-answer">
                  <text class="answer-text">{{ currentWord.en }}</text>
                </view>
              </template>
              
              <!-- 已通过状态：只展示正确的英文 -->
              <template v-else>
                <view class="correct-answer">
                  <text class="answer-text">{{ currentWord.en }}</text>
                </view>
              </template>
            </view>
          </view>

          <view class="btn-box"> 
            <!-- 确认/重试按钮 -->
            <button 
              v-if="!currentWord.passed"
              class="confirm-btn" 
              :class="{ 'correct': showResult && isCorrect, 'wrong': showResult && !isCorrect }"
              @click="handleConfirmOrRetry"
            >
              <text v-if="!showResult">确认</text>
              <text v-else-if="showResult && isCorrect">✓ 正确</text>
              <text v-else>重试</text>
            </button>
            <!-- 下一题按钮 -->
            <button 
              class="next-btn" 
              @click="handleNext"
              v-else
            >
              下一题
            </button>
          </view>
        </view>
      </swiper-item>
    </swiper>
    
    <!-- 自定义指示器 -->
    <view class="custom-indicator"
      :style="{ 'grid-template-columns': `repeat(${wordList.length < 10 ? wordList.length : 10}, 32rpx)` }"
    >
      <view 
        v-for="(word, index) in wordList" 
        :key="index"
        class="indicator-dot"
        :class="{ 
          'active': currentIndex === index,
          'passed': word.passed
        }"
        @click="handleIndicatorClick(index)"
      >
        <text>{{ index + 1 }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.spell-box {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  align-items: center;
}

.word-swiper {
  flex: 1;
  width: 100%;
}

.word-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40rpx;
}

.text-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40rpx;
  padding-top: 30%;
}
.cn-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  
  .cn-text {
    font-size: 48rpx;
    font-weight: bold;
    color: #333;
  }
  
  .status-tag {
    font-size: 24rpx;
    color: #999;
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    background-color: #f5f5f5;
    
    &.passed {
      color: #52c41a;
      background-color: #f6ffed;
      border: 1px solid #b7eb8f;
    }
  }
}

.en-box {
  width: 100%;
  max-width: 600rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  
  .en-input {
    height: 88rpx;
    padding: 0 30rpx;
    font-size: 32rpx;
    border: none;
    border-bottom: 2rpx solid #d9d9d9;
    background-color: transparent;
    text-align: center;
    
    &::placeholder {
      text-align: center;
      color: #999;
    }
    
    &:focus {
      border-bottom-color: #5914c9;
    }
  }
  
  .result-container {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }
  
  .result-box {
    min-height: 60rpx;
    padding: 16rpx 20rpx;
    background-color: #fafafa;
    border-radius: 12rpx;
    display: flex;
    flex-wrap: wrap;
    gap: 4rpx;
    justify-content: center;
    align-items: center;
    
    .result-char {
      font-size: 32rpx;
      font-weight: 500;
      padding: 4rpx 8rpx;
      border-radius: 6rpx;
      
      &.correct {
        color: #52c41a;
        background-color: #f6ffed;
      }
      
      &.wrong {
        color: #ff4d4f;
        background-color: #fff1f0;
        // text-decoration: line-through;
      }
      
      &.missing {
        color: #faad14;
        background-color: #fffbe6;
      }
    }
  }
  
  .correct-answer {
    min-height: 60rpx;
    padding: 16rpx 20rpx;
    background-color: #f6ffed;
    border-radius: 12rpx;
    border: 2rpx solid #b7eb8f;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .answer-text {
      font-size: 36rpx;
      color: #52c41a;
      font-weight: 600;
      letter-spacing: 2rpx;
    }
  }
}

.btn-box { 
  margin: 30rpx 0;
  width: 100%;
}
.confirm-btn {
  width: 80%;
  max-width: 400rpx;
  height: 88rpx;
  background-color: #5914c9;
  color: #fff;
  font-size: 32rpx;
  border-radius: 12rpx;
  border: none;
  
  &.correct {
    background-color: #52c41a;
  }
  
  &.wrong {
    background-color: #ff4d4f;
  }
}

.next-btn {
  width: 80%;
  max-width: 400rpx;
  height: 88rpx;
  background-color: #1890ff;
  color: #fff;
  font-size: 32rpx;
  border-radius: 12rpx;
  border: none;
}

.custom-indicator {
  // width: 100%;
  margin: 20rpx 0;
  gap: 16rpx 32rpx;
  display: grid;
  // grid-template-columns: repeat(10, 32rpx);
  
  .indicator-dot {
    width: 32rpx;
    height: 32rpx;
    border-radius: 50%;
    border: 1px solid black;
    background-color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    cursor: pointer;
    
    text {
      font-size: 18rpx;
      color: #333;
      font-weight: 500;
    }
    
    &.active {
      background-color: #1890ff;
      border-color: #1890ff;
      
      text {
        color: #fff;
      }
    }
    
    &.passed {
      background-color: #52c41a;
      border-color: #52c41a;
      
      text {
        color: #fff;
      }
    }
    
    &.active.passed {
      background-color: #52c41a;
      border-color: #52c41a;
      
      text {
        color: #fff;
      }
    }
    
    &:active {
      transform: scale(0.9);
    }
  }
}
</style>