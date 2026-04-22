<script setup>
import { ref, computed, watch } from 'vue'

/**
 * 四选一卡片练习（保留原有双缓冲 Swiper 架构）
 * - 双缓冲 swiper：仅 2 个 swiper-item，换题时写入非当前槽再切 :current，复用 DOM
 * - 不展示轮播点；disable-touch + touchmove 禁止滑动；仅「下一题」切换
 * - 首次无错答对则 word.passed = true；有错后再答对仍可下一题但不标通过
 */

const props = defineProps({
  words: {
    type: Array,
    default: () => []
  },
  progressMap: {
    type: Object,
    default: () => ({})
  },
  sessionId: {
    type: String,
    default: ''
  },
  bookId: {
    type: String,
    default: 'cet4'
  }
})

const emit = defineEmits(['stage-complete'])

/**
 * 将云函数返回的单词数据转换为组件内部格式
 */
const wordList = computed(() => {
  return props.words.map(word => ({
    _id: word._id,
    targetEn: word.word,  // 字段映射
    passed: props.progressMap[word._id]?.card_done || false,
    options: word.options || []
  }))
})

/** 从前往后找第一个未通过（passed === false） */
const findFromStartIndex = () => {
  for (let i = 0; i < wordList.value.length; i++) {
    if (!wordList.value[i].passed) return i
  }
  return -1
}

/** 从 startIndex 之后找下一个未通过 */
const findForwardIndex = (startIndex) => {
  for (let i = startIndex + 1; i < wordList.value.length; i++) {
    if (!wordList.value[i].passed) return i
  }
  return -1
}

/** 初始化双槽：首题 + 下一道未通过（若无则两槽同题，仅占位） */
function initSlotWordIndex() {
  const u = findFromStartIndex()
  if (u === -1) return [0, 0]
  const v = findForwardIndex(u)
  return [u, v !== -1 ? v : u]
}

/** 每个物理槽当前展示的 wordList 下标 */
const slotWordIndex = ref(initSlotWordIndex())
/** 当前可见的是槽 0 还是槽 1（对应 swiper :current） */
const swiperPane = ref(0)
/** 代码切换 swiper 时置 true，@change 首帧忽略 */
const isProgrammaticChange = ref(false)

/** 当前屏对应的逻辑题下标 */
const visibleWordIndex = computed(() => slotWordIndex.value[swiperPane.value])

/** 每题独立：是否已点中正确项；点错的选项下标 */
const rounds = ref(
  wordList.value.map(() => ({
    done: false,
    wrong: /** @type {number[]} */ ([]),
  })),
)

/**
 * 监听 props 变化，重新初始化状态
 */
watch(() => props.words, () => {
  if (props.words.length > 0) {
    // 重新初始化双槽
    slotWordIndex.value = initSlotWordIndex()
    swiperPane.value = 0
    
    // 重置 rounds 数组
    rounds.value = wordList.value.map(() => ({
      done: false,
      wrong: [],
    }))
    
    console.log('[Card] ========== Props 变化 ==========')
    console.log('[Card] words.length:', props.words.length)
    console.log('[Card] slotWordIndex:', slotWordIndex.value)
    console.log('[Card] firstWord:', wordList.value[0])
    console.log('[Card] firstWordOptions:', wordList.value[0]?.options)
    console.log('[Card] ====================================')
  }
}, { immediate: true })

/**
 * 未通过（passed === false）的题目，每次被「下一题」切到可见时重新作答
 *（曾选错/非首次点对后再来访，清空上一轮界面状态）
 */
const resetRoundIfNotPassed = (wIdx) => {
  const w = wordList.value[wIdx]
  if (!w || w.passed) return
  rounds.value[wIdx] = {
    done: false,
    wrong: [],
  }
}

/** 计算「下一道」逻辑下标（与旧版 goNextUnpassed 一致） */
const resolveNextWordIndex = (fromIndex) => {
  let target = findForwardIndex(fromIndex)
  if (target === -1) target = findFromStartIndex()
  return target
}

/**
 * 下一题：数据写入「非当前槽」→ 再切 swiperPane，实现双缓冲复用
 */
const goNextUnpassed = () => {
  const visible = visibleWordIndex.value
  const target = resolveNextWordIndex(visible)

  // 如果没有其他未完成的单词，检查当前单词是否已完成
  if (target === -1) {
    const currentWord = wordList.value[visible]
    
    // 如果当前单词也未完成（答错了），重置当前单词的作答状态，让用户重新作答
    if (currentWord && !currentWord.passed) {
      console.log('[Card] ⚠️ 最后一个单词未完成，重置作答状态')
      resetRoundIfNotPassed(visible)
      return  // 停留在当前单词，但清空作答状态
    }
    
    // 所有单词都完成了
    uni.showToast({
      title: '没有未通过的单词了',
      icon: 'none',
    })
    return
  }

  // 仅一道未通过且就是当前题时，需要判断是否需要重置
  if (target === visible) {
    const currentWord = wordList.value[visible]
    const r = rounds.value[visible]
    
    // 如果当前单词未完成且本轮已作答（答错后），重置作答状态
    if (currentWord && !currentWord.passed && r.done) {
      console.log('[Card] ⚠️ 唯一未完成的单词已作答，重置状态')
      resetRoundIfNotPassed(visible)
      return  // 停留在当前单词，但清空作答状态
    }
    
    // 否则不翻转两页（避免同题复制闪烁）
    return
  }

  const inactive = 1 - swiperPane.value
  const nextSlots = [...slotWordIndex.value]
  nextSlots[inactive] = target
  // 切到本题再展示前，若仍未通过则重置作答（双缓冲槽复用后「再见到」同一题）
  resetRoundIfNotPassed(target)
  slotWordIndex.value = nextSlots

  isProgrammaticChange.value = true
  swiperPane.value = inactive
}

const handleNext = () => {
  goNextUnpassed()
}

const onSwiperChange = (e) => {
  if (isProgrammaticChange.value) {
    isProgrammaticChange.value = false
    return
  }
  // 已禁止手势；若某端仍触发，与可见槽对齐
  const cur = e.detail.current
  if (cur === 0 || cur === 1) {
    swiperPane.value = cur
  }
}

const isCorrectOption = (option, word) =>
  option.en.toLowerCase() === word.targetEn.toLowerCase()

/** 英文行：未作答时隐藏；点错或整题完成后展示 */
const showEnOnCard = (wIdx, idx) => {
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  if (word.passed || r.done) return true
  return r.wrong.includes(idx)
}

/** 正确项绿；错项红保持；其余中性 */
const cardClass = (wIdx, idx) => {
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  const opt = word.options[idx]
  const correct = isCorrectOption(opt, word)

  if (correct && (r.done || word.passed)) return 'correct'
  if (r.wrong.includes(idx)) return 'wrong'
  if (!r.done && !word.passed) return ''
  return 'neutral'
}

/**
 * pane：0 | 1，仅当前可见槽响应点击
 * wIdx：该槽绑定的 wordList 下标
 */
const onCardTap = (pane, wIdx, idx) => {
  if (pane !== swiperPane.value) return
  if (wIdx !== visibleWordIndex.value) return

  const word = wordList.value[wIdx]
  if (word.passed) return
  const r = rounds.value[wIdx]
  if (r.done) return

  const opt = word.options[idx]
  if (isCorrectOption(opt, word)) {
    const hadWrong = r.wrong.length > 0

    // ✅ 只有首次答对才标记为完成并触发事件
    if (!hadWrong) {
      word.passed = true

      // ✅ 只有首次答对才触发 stage-complete 事件
      emit('stage-complete', word._id, 'card', 'good')

      console.log('[Card] ✅ 首次答对:', { wordId: word._id, rating: 'good' })
    } else {
      console.log('[Card] ⚠️ 答错后答对，不标记为完成:', { wordId: word._id })
    }

    r.done = true
  } else if (!r.wrong.includes(idx)) {
    r.wrong = [...r.wrong, idx]
    console.log('[Card] 答错:', { wordId: word._id, option: opt.en })
  }
}

/** 某槽是否展示「下一题」按钮（仅当前可见槽且本题已答完） */
const showNextForPane = (pane) => {
  if (pane !== swiperPane.value) return false
  const wIdx = slotWordIndex.value[pane]
  const word = wordList.value[wIdx]
  return word.passed || rounds.value[wIdx].done
}
</script>

<template>
  <view class="card-box">
    <!-- 仅 2 屏；:current 绑定 swiperPane，禁止手势 -->
    <swiper
      class="word-swiper"
      :current="swiperPane"
      :indicator-dots="false"
      :autoplay="false"
      :circular="true"
      :disable-touch="true"
      @touchmove.stop.prevent
      @change="onSwiperChange"
    >
      <swiper-item
        v-for="pane in [0, 1]"
        :key="`pane-${pane}-${slotWordIndex[pane]}`"
      >
        <view class="slide-inner">
          <template v-if="wordList[slotWordIndex[pane]]">
            <view class="text-area">
              <text class="target-label">目标英文</text>
              <text class="target-en">{{ wordList[slotWordIndex[pane]].targetEn }}</text>
            </view>

            <view class="cards-area">
              <view
                v-for="(opt, idx) in wordList[slotWordIndex[pane]].options"
                :key="idx"
                class="option-card"
                :class="cardClass(slotWordIndex[pane], idx)"
                @click="onCardTap(pane, slotWordIndex[pane], idx)"
              >
                <text v-if="showEnOnCard(slotWordIndex[pane], idx)" class="opt-en">{{ opt.en }}</text>
                <text v-else class="opt-en opt-en--hidden">•••</text>
                <text class="opt-cn">{{ opt.cn }}</text>
              </view>
            </view>

            <view class="footer-actions">
              <button v-if="showNextForPane(pane)" class="next-btn" @click="handleNext">下一题</button>
            </view>
          </template>
        </view>
      </swiper-item>
    </swiper>
  </view>
</template>

<style lang="scss" scoped>
.card-box {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.word-swiper {
  flex: 1;
  width: 100%;
}

.slide-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 24rpx 24rpx;
  box-sizing: border-box;
}

.text-area {
  flex-shrink: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 40rpx;
}

.target-label {
  font-size: 24rpx;
  color: #999;
}

.target-en {
  font-size: 52rpx;
  font-weight: 700;
  color: #333;
  letter-spacing: 2rpx;
}

.cards-area {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  align-items: stretch;
}

.option-card {
  width: 100%;
  min-height: 140rpx;
  padding: 24rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border-radius: 16rpx;
  border: 2rpx solid #e8e8e8;
  background-color: #fafafa;
  box-sizing: border-box;
  transition:
    background-color 0.2s,
    border-color 0.2s;

  &.correct {
    background-color: #f6ffed;
    border-color: #52c41a;
  }

  &.wrong {
    background-color: #fff1f0;
    border-color: #ff4d4f;
  }

  &.neutral {
    background-color: #fafafa;
    border-color: #e8e8e8;
  }
}

.opt-en {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;

  &--hidden {
    letter-spacing: 6rpx;
    color: #bfbfbf;
    font-weight: 500;
  }
}

.opt-cn {
  font-size: 26rpx;
  color: #666;
  text-align: center;
  line-height: 1.4;
}

.footer-actions {
  width: 100%;
  margin-top: 32rpx;
  min-height: 100rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.next-btn {
  width: 100%;
  height: 88rpx;
  background-color: #1890ff;
  color: #fff;
  font-size: 32rpx;
  border-radius: 12rpx;
  border: none;
}
</style>