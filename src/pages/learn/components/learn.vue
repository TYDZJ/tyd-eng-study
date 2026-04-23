<script setup>
import { ref, computed, watch } from 'vue'

/**
 * 认读练习（learn 阶段）
 *
 * UI 与交互（与 card.vue 同为双缓冲 swiper，仅「下一题」切题，禁手势滑动）：
 * - 文字区：英文 + 中文；首轮未点前不展示中文
 * - 首轮：认识 | 不认识
 * - 展开后：下一题 | 记错了（仅首轮点「认识」后出现记错了；首轮「不认识」只有下一题）
 * - 认识 → 本地 passed=true；不认识 → passed=false；记错了 → 撤销认识带来的 passed，中文仍展开
 * - 再次进入未通过题时 resetRoundIfNotPassed 会清空 revealed，避免背屏槽位复用脏状态
 *
 * 数据与后端：
 * - words / progress_map 由父页 getOrCreateActiveSession 下发；progressMap[wordId].learn_done 为服务端认读是否完成
 * - 评分映射（提交给云函数 stage=learn）：认识=good，不认识=again，记错了=hard
 * - 仅在点击「下一题」时 emit('stage-complete', wordId, 'learn', rating, callbacks)；由 index.vue 调 submitWordProgress
 * - callbacks.onSuccess：提交成功后再翻页；失败不翻页，由父组件 toast（本组件 onError 可留空）
 *
 * sessionId / bookId：与 card 对齐传入，便于以后在子组件内扩展；当前提交仍走父组件
 */

// ---------- Props：会话单词与进度（与父页 index.vue / 云函数返回结构一致）----------

const props = defineProps({
  words: {
    type: Array,
    default: () => [],
  },
  progressMap: {
    type: Object,
    default: () => ({}),
  },
  sessionId: {
    type: String,
    default: '',
  },
  bookId: {
    type: String,
    default: 'cet4',
  },
})

// ---------- 事件：父组件监听 stage-complete，内部统一调 submitWordProgress ----------
// 签名：emit(wordId, 'learn', rating, { onSuccess?, onError? })；card 阶段无第 4 参

const emit = defineEmits(['stage-complete'])

/** 取首条释义拼中文展示行（与 card 生成选项时的展示习惯一致） */
function formatWordCn(word) {
  const t = word.translations?.[0]
  if (!t) return ''
  return `${t.type ? `${t.type} ` : ''}${t.translation || ''}`.trim()
}

/**
 * 当前题列表（ref 而非纯 computed）：需在用户操作里改写 passed、与 rounds 下标对齐
 * passed：本地「是否算通过」；初始化时与 progressMap.learn_done 对齐，服务端已学完则不再要求提交
 */
const wordList = ref([])

/** wordId -> 待提交的 SM2 档位；在点「认识/不认识/记错了」时写入，点「下一题」时消费 */
const pendingRating = ref(/** @type {Record<string, string>} */ ({}))

/** 将父组件 words + progressMap 映射为 wordList 行（槽位与 rounds 由外层 watch 重置） */
function syncWordListFromProps() {
  wordList.value = props.words.map((word) => ({
    _id: word._id,
    en: word.word,
    cn: formatWordCn(word),
    passed: props.progressMap[word._id]?.learn_done === true,
  }))
}

/** 第一个仍待完成认读的词下标（passed === false） */
const findFromStartIndex = () => {
  for (let i = 0; i < wordList.value.length; i++) {
    if (!wordList.value[i].passed) return i
  }
  return -1
}

/** 从 startIndex 之后第一个未完成的词下标 */
const findForwardIndex = (startIndex) => {
  for (let i = startIndex + 1; i < wordList.value.length; i++) {
    if (!wordList.value[i].passed) return i
  }
  return -1
}

/** 双槽初始：第一道未做题 + 下一道（没有下一道则两槽同索引，避免空槽） */
function initSlotWordIndex() {
  const u = findFromStartIndex()
  if (u === -1) return [0, 0]
  const v = findForwardIndex(u)
  return [u, v !== -1 ? v : u]
}

// ---------- 双缓冲 swiper：两槽 slotWordIndex[0|1]，可见槽 swiperPane；仅代码改 current ----------

const slotWordIndex = ref(initSlotWordIndex())
/** 当前可见的是槽 0 还是 1，对应 swiper :current */
const swiperPane = ref(0)
/** 代码设置 :current 后，首帧 @change 忽略，避免与手势逻辑打架 */
const isProgrammaticChange = ref(false)

/** 当前屏对应的 wordList 下标 */
const visibleWordIndex = computed(() => slotWordIndex.value[swiperPane.value])

/** 每题 UI：是否已点过首轮（展开中文）；与 word.passed、服务端 learn_done 独立 */
const rounds = ref(
  wordList.value.map(() => ({
    revealed: false,
  })),
)

/**
 * words 变化（新会话或词表替换）：重置槽位、轮次、待提交缓存
 * 故意不监听 progressMap 做全量重置：父组件每次 submit 都会改 progressMap，否则会打断当前 swiper 与 revealed 状态
 */
watch(
  () => props.words,
  () => {
    if (props.words.length === 0) {
      wordList.value = []
      rounds.value = []
      pendingRating.value = {}
      return
    }
    syncWordListFromProps()
    slotWordIndex.value = initSlotWordIndex()
    swiperPane.value = 0
    rounds.value = wordList.value.map(() => ({ revealed: false }))
    pendingRating.value = {}
  },
  { deep: true, immediate: true },
)

/** 仅把服务端 learn_done 合并进本地 passed，便于重进页面续学且不闪动整页 */
watch(
  () => props.progressMap,
  (pm) => {
    if (!pm || wordList.value.length === 0) return
    wordList.value.forEach((w) => {
      if (pm[w._id]?.learn_done === true) w.passed = true
    })
  },
  { deep: true },
)

/** 切到仍未通过的题时清空 revealed，避免非活跃槽复用后仍显示上一轮已展开 */
const resetRoundIfNotPassed = (wIdx) => {
  const w = wordList.value[wIdx]
  if (!w || w.passed) return
  rounds.value[wIdx] = { revealed: false }
}

/** 下一题目标：先向后找未完成，再从头找（与 card 一致） */
const resolveNextWordIndex = (fromIndex) => {
  let target = findForwardIndex(fromIndex)
  if (target === -1) target = findFromStartIndex()
  return target
}

/**
 * 写入非活跃槽下标 → resetRound → 切换 swiperPane
 * 仅剩一道未完成且就是本题时不翻页，减轻同题双槽闪烁
 */
const goNextUnpassed = () => {
  const visible = visibleWordIndex.value
  const target = resolveNextWordIndex(visible)

  if (target === -1) {
    uni.showToast({
      title: '没有未完成的单词了',
      icon: 'none',
    })
    return
  }

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

/**
 * 「下一题」：
 * - 若该词服务端已 learn_done：只翻页，不重复 submit
 * - 否则必须有 pendingRating，emit 给父组件；成功回调里再翻页
 */
const handleNext = () => {
  const wIdx = visibleWordIndex.value
  const word = wordList.value[wIdx]
  if (!word) return

  const wordId = word._id
  const serverDone = props.progressMap[wordId]?.learn_done === true

  if (serverDone) {
    goNextUnpassed()
    return
  }

  const rating = pendingRating.value[wordId]
  if (!rating) {
    uni.showToast({
      title: '请先点击「认识」或「不认识」',
      icon: 'none',
    })
    return
  }

  emit('stage-complete', wordId, 'learn', rating, {
    onSuccess: () => {
      delete pendingRating.value[wordId]
      word.passed = true
      // 已是本阶段最后一词时不翻页，避免 goNextUnpassed 误报「没有未完成」
      if (findFromStartIndex() !== -1) {
        goNextUnpassed()
      }
    },
    onError: () => {},
  })
}

/** 手势已禁用；若某端仍触发 change，仅同步 swiperPane */
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

/** 中文：首轮未点前隐藏；已 reveal 或本地/服务端已通过则显示 */
const showChinese = (wIdx) => {
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  return r.revealed || word.passed
}

/** 首轮按钮：未展开且本题未标本地通过 */
const showPhase1 = (wIdx) => {
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  return !r.revealed && !word.passed
}

/**
 * 认识：仅响应当前可见槽；写入 pending good、本地 passed、展开
 * pane 与 wIdx 防背屏误点
 */
const onKnow = (pane, wIdx) => {
  if (pane !== swiperPane.value || wIdx !== visibleWordIndex.value) return
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  if (r.revealed || word.passed) return

  pendingRating.value[word._id] = 'good'
  word.passed = true
  r.revealed = true
}

/** 不认识：pending again，不通过，展开 */
const onNotKnow = (pane, wIdx) => {
  if (pane !== swiperPane.value || wIdx !== visibleWordIndex.value) return
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  if (r.revealed || word.passed) return

  pendingRating.value[word._id] = 'again'
  word.passed = false
  r.revealed = true
}

/** 记错了：覆盖为 hard，撤销本地 passed（中文保持展开态由 revealed 决定） */
const onMistake = (pane, wIdx) => {
  if (pane !== swiperPane.value || wIdx !== visibleWordIndex.value) return
  const word = wordList.value[wIdx]
  pendingRating.value[word._id] = 'hard'
  word.passed = false
}

const showNextForPane = (pane) => {
  if (pane !== swiperPane.value) return false
  const wIdx = slotWordIndex.value[pane]
  const word = wordList.value[wIdx]
  const r = rounds.value[wIdx]
  return r.revealed || word.passed
}

/** 跳转单词详情；query 与 word-detail 页约定一致时可再改参数名 */
const openDetail = () => {
  const wIdx = visibleWordIndex.value
  const word = wordList.value[wIdx]
  const q = word?._id ? `?id=${encodeURIComponent(word._id)}` : ''
  uni.navigateTo({
    url: `/pages/word-detail/index${q}`,
  })
}
</script>

<template>
  <view class="learn-box">
    <!-- 双缓冲：仅 2 个 swiper-item；pane 0/1 对应 slotWordIndex[pane] -->
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
            <!-- 英文 + 中文（首轮隐藏中文，占位防布局跳动） -->
            <view class="text-area">
              <text class="word-en" @click="openDetail">{{ wordList[slotWordIndex[pane]].en }}</text>
              <text
                v-if="showChinese(slotWordIndex[pane])"
                class="word-cn"
              >
                {{ wordList[slotWordIndex[pane]].cn }}
              </text>
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

            <!-- 展开后：下一题；仅本地 passed 时显示记错了 -->
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

  &--placeholder {
    min-height: 1.2em;
    opacity: 0;
  }
}

.btn-row {
  width: 100%;
  margin-top: 48rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
  flex-shrink: 0;

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
