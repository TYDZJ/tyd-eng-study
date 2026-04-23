<script setup>
import { ref, computed, watch } from 'vue'

/**
 * 拼写补充模块（纯前端，不提交后端）
 * - 输入数据来自父页面同一会话 words
 * - 拼写练习结果仅本地生效，用于收尾巩固
 * - 退出后不保留，下次不会恢复到 spell 阶段
 */
const props = defineProps({
  words: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['done'])

function formatWordCn(word) {
  const tran = word.translations?.[0]
  if (!tran) return ''
  return `${tran.type ? `${tran.type} ` : ''}${tran.translation || ''}`.trim()
}

const wordList = ref([])
const currentIndex = ref(0)

const rounds = ref([])
const isProgrammaticChange = ref(false)

function buildLocalWordList() {
  wordList.value = props.words.map((word) => ({
    _id: word._id,
    en: word.word || '',
    cn: formatWordCn(word),
    passed: false,
  }))
  rounds.value = wordList.value.map(() => ({
    userInput: '',
    showResult: false,
    isFirstAttempt: true,
  }))
  currentIndex.value = 0
}

watch(
  () => props.words,
  () => {
    buildLocalWordList()
  },
  { immediate: true, deep: true },
)

const allDone = computed(() => {
  if (wordList.value.length === 0) return false
  return wordList.value.every((w) => w.passed)
})

/** 某题的逐字对比结果 */
const getCompareResult = (wIdx) => {
  const r = rounds.value[wIdx]
  const word = wordList.value[wIdx]
  if (!r.showResult || !r.userInput) return null

  const input = r.userInput.toLowerCase()
  const target = word.en.toLowerCase()
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
}

/** 某题是否拼写完全正确 */
const isCorrectFor = (wIdx) => {
  const r = rounds.value[wIdx]
  const word = wordList.value[wIdx]
  if (!r.showResult || !r.userInput) return false
  return r.userInput.toLowerCase() === word.en.toLowerCase()
}

// 处理确认或重试按钮点击
const handleConfirmOrRetry = (wIdx) => {
  const r = rounds.value[wIdx]
  if (r.showResult && !isCorrectFor(wIdx)) {
    resetState(wIdx)
    return
  }

  handleConfirm(wIdx)
}

// 处理确认按钮点击
const handleConfirm = (wIdx) => {
  const r = rounds.value[wIdx]
  const word = wordList.value[wIdx]
  if (!r.userInput.trim()) {
    uni.showToast({
      title: '请输入英文单词',
      icon: 'none',
    })
    return
  }

  r.showResult = true

  if (r.isFirstAttempt && isCorrectFor(wIdx)) {
    word.passed = true
  }
}

// 切换到下一个单词（点击按钮）
const handleNext = () => {
  goNextUnpassed('forward')
}

// 重置某一题的状态（重试）
const resetState = (wIdx) => {
  rounds.value[wIdx] = {
    userInput: '',
    showResult: false,
    isFirstAttempt: true,
  }
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

  if (!wordList.value[newIndex].passed) {
    currentIndex.value = newIndex
  } else {
    if (newIndex < oldIndex) {
      targetIndex = findBackwardIndex(newIndex)
    } else {
      targetIndex = findForwardIndex(newIndex)
    }
    if (targetIndex !== -1) {
      currentIndex.value = targetIndex
    } else {
      currentIndex.value = newIndex
    }
  }

  // 每题状态在 rounds[wIdx] 中独立保存，切换时不清空，避免离屏页与当前页绑同一数据
}

const goNextUnpassed = (direction = 'forward') => {
  const startIndex = currentIndex.value
  let targetIndex = -1
  
  if (direction === 'forward') targetIndex = findForwardIndex(startIndex)
  if (targetIndex === -1) targetIndex = findFromStartIndex()
  
  if (targetIndex !== -1) {
    isProgrammaticChange.value = true
    currentIndex.value = targetIndex
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

const handleIndicatorClick = (index) => {
  isProgrammaticChange.value = true
  currentIndex.value = index
}

function handleDoneClick() {
  emit('done')
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
              <template v-if="!word.passed">
                <!-- 输入框 -->
                <input 
                  v-if="!rounds[index].showResult"
                  v-model="rounds[index].userInput" 
                  class="en-input" 
                  type="text" 
                  placeholder="请输入英文单词"
                  @confirm="handleConfirm(index)"
                />
                
                <!-- 对比结果（错误时显示在输入框位置） -->
                <view v-else-if="rounds[index].showResult && !isCorrectFor(index) && getCompareResult(index)" class="result-container">
                  <view class="result-box">
                    <text 
                      v-for="(item, idx) in getCompareResult(index)" 
                      :key="idx"
                      class="result-char"
                      :class="item.status"
                    >
                      {{ item.char }}
                    </text>
                  </view>
                  <!-- 正确答案提示 -->
                  <view class="correct-answer">
                    <text class="answer-text">{{ word.en }}</text>
                  </view>
                </view>
                
                <!-- 正确答案展示（正确时显示） -->
                <view v-else-if="rounds[index].showResult && isCorrectFor(index)" class="correct-answer">
                  <text class="answer-text">{{ word.en }}</text>
                </view>
              </template>
              
              <!-- 已通过状态：只展示正确的英文 -->
              <template v-else>
                <view class="correct-answer">
                  <text class="answer-text">{{ word.en }}</text>
                </view>
              </template>
            </view>
          </view>

          <view class="btn-box"> 
            <!-- 确认/重试按钮 -->
            <button 
              v-if="!word.passed"
              class="confirm-btn" 
              :class="{ 'correct': rounds[index].showResult && isCorrectFor(index), 'wrong': rounds[index].showResult && !isCorrectFor(index) }"
              @click="handleConfirmOrRetry(index)"
            >
              <text v-if="!rounds[index].showResult">确认</text>
              <text v-else-if="rounds[index].showResult && isCorrectFor(index)">✓ 正确</text>
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

    <view v-if="allDone" class="spell-finish-box">
      <button class="spell-finish-btn" @click="handleDoneClick">完成拼写并返回</button>
      <text class="spell-finish-tip">拼写为补充练习，不计入学习进度</text>
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

.spell-finish-box {
  width: 100%;
  padding: 12rpx 0 24rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  align-items: center;
}

.spell-finish-btn {
  width: 80%;
  max-width: 420rpx;
  height: 80rpx;
  line-height: 80rpx;
  background: linear-gradient(90deg, #1890ff, #52c41a);
  color: #fff;
  border: none;
  border-radius: 10rpx;
  font-size: 28rpx;
}

.spell-finish-tip {
  font-size: 22rpx;
  color: #999;
}
</style>