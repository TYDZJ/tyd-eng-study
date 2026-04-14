<script setup>
import { ref, computed } from 'vue'

/**
 * 认读练习（双缓冲 swiper，逻辑与 card.vue 一致）
 * - 无轮播点、禁止滑动，仅「下一题」切换题目
 * - 文字区 col：英文 + 中文；未点首轮前不展示中文
 * - 首轮按钮 row space-between：认识 | 不认识
 * - 点任一项后展示中文，按钮区：下一题 | 记错了
 * - 认识 → passed=true；不认识 → passed=false；记错了 → 仅撤销「认识」带来的 passed（首轮点「不认识」后不展示记错了）
 * - 再次进入未通过题时 resetRoundIfNotPassed 清空 revealed
 */
const wordList = ref([
  { en: 'apple', cn: 'n. 苹果', passed: false },
  { en: 'abandon', cn: 'v. 放弃，抛弃', passed: false },
  { en: 'benefit', cn: 'n. 益处；v. 有益于', passed: false },
  { en: 'culture', cn: 'n. 文化', passed: false },
  { en: 'delicate', cn: 'adj. 精致的；易碎的', passed: false },
])

/** 从前往后第一个 passed === false */
const findFromStartIndex = () => {
  for (let i = 0; i < wordList.value.length; i++) {
    if (!wordList.value[i].passed) return i
  }
  return -1
}

/** startIndex 之后第一个未通过 */
const findForwardIndex = (startIndex) => {
  for (let i = startIndex + 1; i < wordList.value.length; i++) {
    if (!wordList.value[i].passed) return i
  }
  return -1
}

/** 双槽初始：首道未做题 + 下一道（无则两槽同索引占位） */
function initSlotWordIndex() {
  const u = findFromStartIndex()
  if (u === -1) return [0, 0]
  const v = findForwardIndex(u)
  return [u, v !== -1 ? v : u]
}

/** 两槽各自对应的 wordList 下标 */
const slotWordIndex = ref(initSlotWordIndex())
/** 当前可见槽 0 | 1，对应 swiper :current */
const swiperPane = ref(0)
/** 代码改 current 时为 true，@change 首帧忽略 */
const isProgrammaticChange = ref(false)

/** 当前屏逻辑题下标 */
const visibleWordIndex = computed(() => slotWordIndex.value[swiperPane.value])

/** 每题 UI：是否已点过首轮（展开中文）；与 word.passed 独立 */
const rounds = ref(
  wordList.value.map(() => ({
    revealed: false,
  })),
)

/**
 * 切到「仍未通过」的题目时清空 revealed，避免双缓冲复用后仍显示上一轮展开态
 */
const resetRoundIfNotPassed = (wIdx) => {
  const w = wordList.value[wIdx]
  if (!w || w.passed) return
  rounds.value[wIdx] = { revealed: false }
}

/** 下一题目标：先向后找未通过，再从头找（与 card 一致） */
const resolveNextWordIndex = (fromIndex) => {
  let target = findForwardIndex(fromIndex)
  if (target === -1) target = findFromStartIndex()
  return target
}

/**
 * 写入非活跃槽 → resetRound → 切 swiperPane（双缓冲）
 */
const goNextUnpassed = () => {
  const visible = visibleWordIndex.value
  const target = resolveNextWordIndex(visible)

  if (target === -1) {
    uni.showToast({
      title: '没有未通过的单词了',
      icon: 'none',
    })
    return
  }

  // 仅剩一道未通过且就是本题时不翻页，避免两槽同题闪烁
  if (target === visible) {
    return
  }

  const inactive = 1 - swiperPane.value
  const nextSlots = [...slotWordIndex.value]
  nextSlots[inactive] = target
  resetRoundIfNotPassed(target)
  slotWordIndex.value = nextSlots

  isProgrammaticChange.value = true
  swiperPane.value = inactive
}

const handleNext = () => {
  goNextUnpassed()
}

/** 手势基本禁用；异常触发时同步 swiperPane */
const onSwiperChange = (e) => {
  if (isProgrammaticChange.value) {
    isProgrammaticChange.value = false
    return
  }
  const cur = e.detail.current
  if (cur === 0 || cur === 1) {
    swiperPane.value = cur
  }
}

/** 中文：首轮未点前隐藏；已 reveal 或外部已标通过则显示 */
const showChinese = (wIdx) => {
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  return r.revealed || word.passed
}

/** 首轮：未展开且本题未标通过（两条件同时满足才显示 认识|不认识） */
const showPhase1 = (wIdx) => {
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  return !r.revealed && !word.passed
}

/** 认识：标通过并展开（pane 须为当前可见槽，防点到背屏） */
const onKnow = (pane, wIdx) => {
  if (pane !== swiperPane.value || wIdx !== visibleWordIndex.value) return
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  if (r.revealed || word.passed) return

  word.passed = true
  r.revealed = true
}

/** 不认识：不通过并展开（同 onKnow：仅响应可见槽） */
const onNotKnow = (pane, wIdx) => {
  if (pane !== swiperPane.value || wIdx !== visibleWordIndex.value) return
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  if (r.revealed || word.passed) return

  word.passed = false
  r.revealed = true
}

/** 次轮：撤销「认识」带来的 passed（中文仍展开） */
const onMistake = (pane, wIdx) => {
  if (pane !== swiperPane.value || wIdx !== visibleWordIndex.value) return
  wordList.value[wIdx].passed = false
}

/**
 * 当前槽是否显示「下一题 | 记错了」：已展开且为可见槽
 */
const showNextForPane = (pane) => {
  if (pane !== swiperPane.value) return false
  const wIdx = slotWordIndex.value[pane]
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  return r.revealed || word.passed
}

const openDetail = () => {
  uni.navigateTo({
    url: '/pages/word-detail/index',
  })
}
</script>

<template>
  <view class="learn-box">
    <!-- 仅 2 屏双缓冲；pane 为槽位 0/1，与 slotWordIndex[pane] 绑定本题数据 -->
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
        :key="`learn-pane-${pane}-${slotWordIndex[pane]}`"
      >
        <view class="slide-inner">
          <template v-if="wordList[slotWordIndex[pane]]">
            <!-- 文字区：纵向，英文 + 中文（首轮隐藏中文） -->
            <view class="text-area">
              <text class="word-en" @click="openDetail">{{ wordList[slotWordIndex[pane]].en }}</text>
              <text
                v-if="showChinese(slotWordIndex[pane])"
                class="word-cn"
              >
                {{ wordList[slotWordIndex[pane]].cn }}
              </text>
              <!-- 占位防展开瞬间布局跳动 -->
              <text v-else class="word-cn word-cn--placeholder"> </text>
            </view>

            <!-- 首轮：认识 | 不认识 -->
            <view
              v-if="showPhase1(slotWordIndex[pane])"
              class="btn-row"
            >
              <button
                class="btn-item btn-know"
                @click="onKnow(pane, slotWordIndex[pane])"
              >
                认识
              </button>
              <button
                class="btn-item btn-not-know"
                @click="onNotKnow(pane, slotWordIndex[pane])"
              >
                不认识
              </button>
            </view>

            <!-- 展开后：仅「认识」时显示 记错了；「不认识」仅下一题 -->
            <view
              v-else-if="showNextForPane(pane)"
              class="btn-row"
              :class="{ 'btn-row--next-only': !wordList[slotWordIndex[pane]].passed }"
            >
              <button class="btn-item btn-next" @click="handleNext">下一题</button>
              <button
                v-if="wordList[slotWordIndex[pane]].passed"
                class="btn-item btn-mistake"
                @click="onMistake(pane, slotWordIndex[pane])"
              >
                记错了
              </button>
            </view>
          </template>
        </view>
      </swiper-item>
    </swiper>
  </view>
</template>

<style lang="scss" scoped>
/* 根容器与 swiper 占满父级高度 */
.learn-box {
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
  align-items: stretch;
  padding: 32rpx 24rpx 24rpx;
  box-sizing: border-box;
}

.text-area {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28rpx;
  padding-top: 20%;
}

.word-en {
  font-size: 52rpx;
  font-weight: 700;
  color: #333;
  letter-spacing: 2rpx;
  text-align: center;
}

.word-cn {
  font-size: 30rpx;
  color: #666;
  line-height: 1.5;
  text-align: center;

  /* 隐藏中文时占位，高度与正文接近 */
  &--placeholder {
    min-height: 1.2em;
    opacity: 0;
  }
}

/* 横向均分，两端对齐由 flex + gap 实现 */
.btn-row {
  width: 100%;
  margin-top: 48rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
  flex-shrink: 0;

  /* 仅下一题时占满一行 */
  &--next-only .btn-next {
    flex: 1;
    max-width: 100%;
  }
}

.btn-item {
  flex: 1;
  height: 88rpx;
  font-size: 30rpx;
  border-radius: 12rpx;
  border: none;
  line-height: 88rpx;
}

.btn-know {
  background-color: #52c41a;
  color: #fff;
}

.btn-not-know {
  background-color: #f5f5f5;
  color: #666;
  border: 2rpx solid #d9d9d9;
}

.btn-next {
  background-color: #1890ff;
  color: #fff;
}

.btn-mistake {
  background-color: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ffccc7;
}
</style>
