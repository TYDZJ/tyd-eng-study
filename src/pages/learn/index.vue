<script setup>
import TopNav from '@/components/top-nav.vue'
import Card from './components/card.vue'
import Learn from './components/learn.vue'
import Spell from './components/spell.vue'

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getOrCreateActiveSession, submitWordProgress } from '@/utils/wx-cloud-call'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// ==================== 状态管理 ====================
const sessionId = ref('')
const bookId = ref('cet4')
const mode = ref('learn') // 'learn' | 'review'
const words = ref([])
const progressMap = ref({})
const currentStage = ref('card') // 'card' | 'learn' | 'spell'
const isLoading = ref(false)

// ==================== 计算属性 ====================

/**
 * 已完成的单词数量（根据当前阶段动态计算）
 */
const finishedCount = computed(() => {
  // 直接统计 progressMap 中标记为完成的数量
  const progresses = Object.values(progressMap.value)
  
  if (progresses.length === 0) return 0
  
  return progresses.filter(progress => {
    if (!progress) return false
    
    // 根据当前阶段判断是否完成
    if (currentStage.value === 'card') {
      return progress.card_done === true
    }
    return progress.learn_done === true
  }).length
})

/**
 * 总单词数
 */
const totalCount = computed(() => words.value.length)

/**
 * 进度百分比
 */
const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((finishedCount.value / totalCount.value) * 100)
})

/**
 * 判断当前阶段是否所有单词都已完成
 */
const isCurrentStageFinished = computed(() => {
  const progresses = Object.values(progressMap.value)
  
  if (progresses.length === 0) return false
  
  // 检查 progressMap 中所有单词的当前阶段是否都已完成
  return progresses.every(progress => {
    if (!progress) return false
    
    if (currentStage.value === 'card') {
      return progress.card_done === true
    }
    return progress.learn_done === true
  })
})

const stageLabel = computed(() => {
  if (currentStage.value === 'card') return '卡片'
  if (currentStage.value === 'learn') return '认读'
  return '拼写（补充）'
})

// ==================== 生命周期 ====================
onLoad(async (options) => {
  // 接收路由参数
  if (options.book_id) bookId.value = options.book_id
  if (options.mode) mode.value = options.mode
  
  // 检查登录状态
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
    return
  }
  
  // 初始化会话
  await initSession()
})

// ==================== 核心方法 ====================

/**
 * 初始化或恢复会话
 */
async function initSession() {
  isLoading.value = true
  try {
    // ✅ 不传 bookId，由后端从 user_book_settings 获取用户当前词书
    const result = await getOrCreateActiveSession({
      mode: mode.value,
      sessionSize: 20
    })
    
    console.log('[Learn] ========== 云函数返回 ==========')
    console.log('[Learn]', result)
    
    if (result.code !== 0) {
      throw new Error(result.message || '获取会话失败')
    }
    
    const data = result.data
    
    if (!data.session_id) {
      // 没有可学习的单词
      uni.showToast({ title: data.message || '暂无可学习的单词', icon: 'none' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
      return
    }
    
    // 更新状态
    sessionId.value = data.session_id
    words.value = data.words || []
    progressMap.value = data.progress_map || {}
    currentStage.value = data.current_stage || (mode.value === 'learn' ? 'card' : 'learn')
    
    console.log('[Learn] ========== 会话数据详情 ==========')
    console.log('[Learn] sessionId:', sessionId.value)
    console.log('[Learn] wordCount:', words.value.length)
    console.log('[Learn] stage:', currentStage.value)
    console.log('[Learn] firstWord:', words.value[0])
    console.log('[Learn] firstWordOptions:', words.value[0]?.options)
    console.log('[Learn] progressMapKeys:', Object.keys(progressMap.value))
    console.log('[Learn] ====================================')
    
  } catch (error) {
    console.error('[Learn] 初始化会话失败:', error)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  } finally {
    isLoading.value = false
  }
}

/**
 * 阶段完成回调（由子组件触发）
 * @param {String} wordId - 单词ID
 * @param {String} stage - 完成的阶段
 * @param {String} rating - 评分
 */
/**
 * @param {string} wordId
 * @param {'card'|'learn'} stage
 * @param {'again'|'hard'|'good'|'easy'|null} rating
 * @param {{ onSuccess?: () => void, onError?: () => void }} [callbacks] learn 阶段提交成功后翻页用
 */
async function handleStageComplete(wordId, stage, rating, callbacks) {
  console.log('[Learn] 阶段完成:', { wordId, stage, rating })
  if (!['card', 'learn'].includes(stage)) {
    callbacks?.onError?.()
    return
  }

  if (!sessionId.value) {
    uni.showToast({ title: '会话无效', icon: 'none' })
    callbacks?.onError?.()
    return
  }

  try {
    const result = await submitWordProgress({
      sessionId: sessionId.value,
      bookId: bookId.value,
      wordId,
      stage,
      rating: rating || undefined,
    })

    if (!result || result.code !== 0) {
      throw new Error(result?.message || '提交失败')
    }

    const data = result.data || {}

    if (!progressMap.value[wordId]) {
      progressMap.value[wordId] = {
        card_done: false,
        learn_done: false,
        latest_rating: null,
      }
    }

    if (data.word_progress) {
      Object.assign(progressMap.value[wordId], data.word_progress)
    } else {
      if (stage === 'card') progressMap.value[wordId].card_done = true
      else if (stage === 'learn') progressMap.value[wordId].learn_done = true
      if (rating) progressMap.value[wordId].latest_rating = rating
    }

    console.log('[Learn] 更新后进度:', progressMap.value[wordId])
    console.log('[Learn] 当前阶段完成状态:', isCurrentStageFinished.value)
    console.log('[Learn] 当前阶段进度:', `${finishedCount.value}/${totalCount.value}`)

    callbacks?.onSuccess?.()

    if (isCurrentStageFinished.value) {
      console.log('[Learn] ✅ 当前阶段所有单词已完成，等待用户点击下一阶段按钮')
      uni.showToast({
        title: '本阶段完成！点击下方按钮进入下一阶段',
        icon: 'none',
        duration: 2000,
      })
    }
  } catch (error) {
    console.error('[Learn] submitWordProgress 失败:', error)
    uni.showToast({
      title: error?.message || '提交失败，请重试',
      icon: 'none',
    })
    callbacks?.onError?.()
  }
}

/**
 * 用户手动点击进入下一阶段（仅 card -> learn）
 */
function handleNextStage() {
  if (currentStage.value === 'card') {
    currentStage.value = 'learn'
    console.log('[Learn] → 切换到 learn 阶段')
  }
}

/**
 * 进入 spell（可选补充模块，不计后端进度）
 */
function enterSpell() {
  currentStage.value = 'spell'
  uni.showToast({
    title: '拼写为补充练习，不计入进度',
    icon: 'none',
  })
}

function finishWithoutSpell() {
  handleSessionComplete()
}

function handleSpellDone() {
  handleSessionComplete()
}

/**
 * 处理会话完成
 */
function handleSessionComplete() {
  console.log('[Learn] 🎉 会话完成！')
  
  uni.showModal({
    title: '恭喜完成！',
    content: `本组 ${totalCount.value} 个单词已全部学习完成`,
    showCancel: false,
    confirmText: '返回首页',
    success: () => {
      uni.navigateBack()
    }
  })
}
</script>

<template>
  <view class="learn-box">
    <!-- 顶部导航 -->
    <TopNav />
    
    <!-- 进度条和阶段切换按钮 -->
    <view class="progress-bar" v-if="!isLoading && words.length > 0">
      <view class="progress-info">
        <text class="progress-text">{{ finishedCount }}/{{ totalCount }}</text>
        <text class="stage-tag">{{ stageLabel }}</text>
      </view>
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
      </view>
      
      <!-- card 阶段完成后：进入 learn -->
      <view v-if="isCurrentStageFinished && currentStage === 'card'" class="next-stage-btn">
        <button @click="handleNextStage">
          进入认读阶段 →
        </button>
      </view>

      <!-- learn 阶段完成后：spell 可选，不计后端进度 -->
      <view v-if="isCurrentStageFinished && currentStage === 'learn'" class="next-stage-actions">
        <button class="next-stage-btn__primary" @click="enterSpell">
          进入拼写（可选）
        </button>
        <button class="next-stage-btn__ghost" @click="finishWithoutSpell">
          直接完成并返回
        </button>
        <text class="next-stage-tip">拼写仅补充练习，不计入学习进度，退出后不保留</text>
      </view>
    </view>
    
    <!-- 加载状态 -->
    <view class="loading-box" v-if="isLoading">
      <u-loading-icon mode="circle" size="40"></u-loading-icon>
      <text class="loading-text">加载中...</text>
    </view>
    
    <!-- 学习内容 - 暂时只显示 Card 组件 -->
    <view class="learn-item" v-else-if="words.length > 0">
      <Card 
        v-if="currentStage === 'card'" 
        :words="words"
        :progress-map="progressMap"
        :session-id="sessionId"
        :book-id="bookId"
        @stage-complete="handleStageComplete"
      />
      
      <Learn
        v-else-if="currentStage === 'learn'"
        :words="words"
        :progress-map="progressMap"
        :session-id="sessionId"
        :book-id="bookId"
        @stage-complete="handleStageComplete"
      />

      <Spell
        v-else-if="currentStage === 'spell'"
        :words="words"
        @done="handleSpellDone"
      />

      <view v-else class="placeholder-box">
        <text>未知阶段</text>
      </view>
    </view>
    
    <!-- 空状态 -->
    <view class="empty-box" v-else>
      <text class="empty-text">暂无学习内容</text>
    </view>
    
    <u-safe-bottom />
  </view>
</template>

<style lang="scss" scoped>
.learn-box {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: #f5f5f5;
}

/* 进度条 */
.progress-bar {
  padding: 20rpx 30rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
  position: relative;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.progress-text {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
}

.stage-tag {
  font-size: 24rpx;
  color: #1890ff;
  background-color: #e6f7ff;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.progress-track {
  height: 8rpx;
  background-color: #f0f0f0;
  border-radius: 4rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #52c41a);
  border-radius: 4rpx;
  transition: width 0.3s ease;
}

/* 下一阶段按钮 */
.next-stage-btn {
  margin-top: 16rpx;
  
  button {
    width: 100%;
    background: linear-gradient(90deg, #1890ff, #52c41a);
    color: #fff;
    border: none;
    border-radius: 8rpx;
    font-size: 28rpx;
    padding: 16rpx 0;
    font-weight: 500;
    
    &:active {
      opacity: 0.8;
    }
  }
}

.next-stage-actions {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.next-stage-btn__primary {
  width: 100%;
  background: linear-gradient(90deg, #1890ff, #52c41a);
  color: #fff;
  border: none;
  border-radius: 8rpx;
  font-size: 28rpx;
  padding: 16rpx 0;
  font-weight: 500;
}

.next-stage-btn__ghost {
  width: 100%;
  background-color: #fff;
  color: #666;
  border: 1rpx solid #d9d9d9;
  border-radius: 8rpx;
  font-size: 26rpx;
  padding: 14rpx 0;
}

.next-stage-tip {
  font-size: 22rpx;
  color: #999;
  line-height: 1.5;
}

/* 加载状态 */
.loading-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

/* 学习内容 */
.learn-item {
  flex: 1;
  padding: 0 30rpx;
  overflow: hidden;
}

/* 占位符 */
.placeholder-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #999;
}

/* 空状态 */
.empty-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  font-size: 32rpx;
  color: #999;
}
</style>
