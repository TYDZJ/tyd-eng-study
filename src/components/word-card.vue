<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  wordData: {
    type: Object,
    required: true,
    default: () => ({
      "wordRank": 18,
      "headWord": "talk",
      "content": {
        "word": {
          "wordHead": "talk",
          "wordId": "PEPChuZhong7_2_18",
          "content": {
            "sentence": {
              "sentences": [
                {
                  "sContent": "I could hear Sarah and Andy talking in the next room.",
                  "sCn": "我听到萨拉和安迪在隔壁讲话。"
                },
                {
                  "sContent": "Sue and Bob still aren't talking.",
                  "sCn": "休和鲍勃仍然互不理睬。"
                },
                {
                  "sContent": "After a long talk, we decided on divorce.",
                  "sCn": "经过一次长谈后，我们决定离婚。"
                }
              ],
              "desc": "例句"
            },
            "usphone": "tɔk",
            "syno": {
              "synos": [
                {
                  "pos": "vt",
                  "tran": "说；谈话；讨论",
                  "hwds": [
                    { "w": "quo" },
                    { "w": "tell" },
                    { "w": "observe" },
                    { "w": "debate" }
                  ]
                },
                {
                  "pos": "vi",
                  "tran": "谈话；说闲话",
                  "hwds": [
                    { "w": "jerk chin music" },
                    { "w": "dialogize" }
                  ]
                },
                {
                  "pos": "n",
                  "tran": "谈话；演讲；空谈",
                  "hwds": [
                    { "w": "speech" },
                    { "w": "address" },
                    { "w": "lecture" },
                    { "w": "discourse" }
                  ]
                }
              ],
              "desc": "同近"
            },
            "ukphone": "tɔːk",
            "ukspeech": "talk&type=1",
            "phrase": {
              "phrases": [
                {
                  "pContent": "talk about",
                  "pCn": "谈论某事"
                },
                {
                  "pContent": "talk to oneself",
                  "pCn": "自言自语"
                },
                {
                  "pContent": "talk with",
                  "pCn": "与…交谈"
                },
                {
                  "pContent": "talk show",
                  "pCn": "脱口秀；访谈节目"
                },
                {
                  "pContent": "small talk",
                  "pCn": "闲聊；聊天"
                }
              ],
              "desc": "短语"
            },
            "relWord": {
              "desc": "同根",
              "rels": [
                {
                  "pos": "adj",
                  "words": [
                    {
                      "hwd": "talking",
                      "tran": "说话的，多嘴的；有表情的"
                    }
                  ]
                },
                {
                  "pos": "n",
                  "words": [
                    {
                      "hwd": "talking",
                      "tran": "讲话，谈论"
                    },
                    {
                      "hwd": "talker",
                      "tran": "说话的人；健谈者；空谈者"
                    }
                  ]
                },
                {
                  "pos": "v",
                  "words": [
                    {
                      "hwd": "talking",
                      "tran": "谈论；讲话（talk的ing形式）"
                    }
                  ]
                }
              ]
            },
            "usspeech": "talk&type=2",
            "trans": [
              {
                "tranCn": "说话；谈话",
                "descOther": "英释",
                "pos": "v",
                "descCn": "中释",
                "tranOther": "to say things to someone as part of a conversation"
              },
              {
                "tranCn": "交谈",
                "descOther": "英释",
                "pos": "n",
                "descCn": "中释",
                "tranOther": "a conversation"
              }
            ]
          }
        }
      },
      "bookId": "PEPChuZhong7_2"
    })
  },
  // 控制各个区域是否显示
  showTranslation: {
    type: Boolean,
    default: true
  },
  showSentence: {
    type: Boolean,
    default: true
  },
  showPhrase: {
    type: Boolean,
    default: true
  },
  showRelWord: {
    type: Boolean,
    default: true
  },
  showSyno: {
    type: Boolean,
    default: true
  }
})

// 展开/折叠状态
const sentenceExpanded = ref(true)
const phraseExpanded = ref(true)
const relWordExpanded = ref(true)
const synoExpanded = ref(true)

// 计算属性 - 获取各个区域的数据（增加顶层对象保护）
const isValidData = computed(() => {
  return props.wordData && typeof props.wordData === 'object'
})

const english = computed(() => isValidData.value ? (props.wordData.headWord || '') : '')
const usPhone = computed(() => isValidData.value ? (props.wordData.content?.word?.content?.usphone || '') : '')
const ukPhone = computed(() => isValidData.value ? (props.wordData.content?.word?.content?.ukphone || '') : '')
const translations = computed(() => {
  if (!isValidData.value) return []
  const trans = props.wordData.content?.word?.content?.trans || []
  return Array.isArray(trans) ? trans.filter(item => item && typeof item === 'object') : []
})
const sentences = computed(() => {
  if (!isValidData.value) return []
  const sents = props.wordData.content?.word?.content?.sentence?.sentences || []
  return Array.isArray(sents) ? sents.filter(item => item && typeof item === 'object') : []
})
const phrases = computed(() => {
  if (!isValidData.value) return []
  const phrs = props.wordData.content?.word?.content?.phrase?.phrases || []
  return Array.isArray(phrs) ? phrs.filter(item => item && typeof item === 'object') : []
})
const relWords = computed(() => {
  if (!isValidData.value) return []
  const rels = props.wordData.content?.word?.content?.relWord?.rels || []
  return Array.isArray(rels) ? rels.filter(item => item && typeof item === 'object') : []
})
const synos = computed(() => {
  if (!isValidData.value) return []
  const syns = props.wordData.content?.word?.content?.syno?.synos || []
  return Array.isArray(syns) ? syns.filter(item => item && typeof item === 'object') : []
})

// 播放发音
const playAudio = (type) => {
  if (!isValidData.value) return
  
  const audioMap = {
    us: props.wordData.content?.word?.content?.usspeech,
    uk: props.wordData.content?.word?.content?.ukspeech
  }
  
  if (audioMap[type]) {
    // TODO: 实现音频播放逻辑
    console.log(`播放${type === 'us' ? '美' : '英'}式发音:`, audioMap[type])
  }
}

// 高亮例句中的单词
const highlightSentence = (sentence) => {
  if (!sentence || !english.value) return []
  
  // 方案B：优先使用同根词列表进行精确匹配
  const relatedWords = getRelatedWordsList()
  
  let regex
  if (relatedWords.length > 0) {
    // 使用同根词列表构建正则表达式
    const escapedWords = relatedWords.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi')
  } else {
    // 方案A：降级使用单词边界匹配（兜底方案）
    const word = english.value.toLowerCase()
    regex = new RegExp(`\\b(${word}\\w*)\\b`, 'gi')
  }
  
  const parts = sentence.split(regex)
  
  return parts.map((part, index) => {
    if (part && regex.test(part)) {
      // 重置正则表达式的 lastIndex
      regex.lastIndex = 0
      return { text: part, highlight: true, key: index }
    }
    return { text: part, highlight: false, key: index }
  })
}

// 获取同根词列表
const getRelatedWordsList = () => {
  if (!isValidData.value) return []
  
  const rels = props.wordData.content?.word?.content?.relWord?.rels || []
  const words = []
  
  if (Array.isArray(rels)) {
    rels.forEach(rel => {
      if (rel && typeof rel === 'object' && rel.words && Array.isArray(rel.words)) {
        rel.words.forEach(word => {
          if (word && typeof word === 'object' && word.hwd && typeof word.hwd === 'string') {
            words.push(word.hwd.toLowerCase())
          }
        })
      }
    })
  }
  
  // 去重并添加原词
  const uniqueWords = [...new Set(words)]
  if (english.value && !uniqueWords.includes(english.value.toLowerCase())) {
    uniqueWords.unshift(english.value.toLowerCase())
  }
  
  return uniqueWords
}
</script>

<template>
  <view class="word-card-box">
    <!-- 英文单词区 - 无白色背景 -->
    <view class="word-header">
      <text class="english-word">{{ english }}</text>
      <view class="phonetic-box">
        <view class="phonetic-item" @click="playAudio('uk')">
          <text class="phonetic-label">英</text>
          <text class="phonetic-text">/{{ ukPhone }}/</text>
        </view>
        <view class="phonetic-item" @click="playAudio('us')">
          <text class="phonetic-label">美</text>
          <text class="phonetic-text">/{{ usPhone }}/</text>
        </view>
      </view>
    </view>

    <!-- 解释区 - 白色卡片 -->
    <view v-if="showTranslation && translations.length > 0" class="section-card">
      <view class="translation-section">
        <view v-for="(item, index) in translations" :key="index" class="translation-item">
          <text class="pos-tag">{{ item.pos || '' }}</text>
          <text class="translation-text">{{ item.tranCn || '' }}</text>
        </view>
      </view>
    </view>

    <!-- 句子区 - 白色卡片 -->
    <view v-if="showSentence && sentences.length > 0" class="section-card">
      <view class="section-header" @click="sentenceExpanded = !sentenceExpanded">
        <text class="section-title">例句</text>
        <text class="toggle-icon">{{ sentenceExpanded ? '▼' : '▶' }}</text>
      </view>
      <view v-show="sentenceExpanded" class="section-content">
        <view v-for="(sentence, index) in sentences" :key="index" class="sentence-item">
          <view class="sentence-en">
            <text 
              v-for="(part, partIndex) in highlightSentence(sentence.sContent)" 
              :key="partIndex"
              :class="{'highlight-word': part.highlight}"
            >{{ part.text }}</text>
          </view>
          <text class="sentence-cn">{{ sentence.sCn || '' }}</text>
        </view>
      </view>
    </view>

    <!-- 短语区 - 白色卡片 -->
    <view v-if="showPhrase && phrases.length > 0" class="section-card">
      <view class="section-header" @click="phraseExpanded = !phraseExpanded">
        <text class="section-title">短语</text>
        <text class="toggle-icon">{{ phraseExpanded ? '▼' : '▶' }}</text>
      </view>
      <view v-show="phraseExpanded" class="section-content">
        <view v-for="(phrase, index) in phrases" :key="index" class="phrase-item">
          <text class="phrase-en">{{ phrase.pContent || '' }}</text>
          <text class="phrase-cn">{{ phrase.pCn || '' }}</text>
        </view>
      </view>
    </view>

    <!-- 同根词区 - 白色卡片 -->
    <view v-if="showRelWord && relWords.length > 0" class="section-card">
      <view class="section-header" @click="relWordExpanded = !relWordExpanded">
        <text class="section-title">同根词</text>
        <text class="toggle-icon">{{ relWordExpanded ? '▼' : '▶' }}</text>
      </view>
      <view v-show="relWordExpanded" class="section-content">
        <view v-for="(group, groupIndex) in relWords" :key="groupIndex" class="rel-group">
          <text class="rel-pos">{{ group.pos || '' }}</text>
          <view class="rel-words-list" v-if="group.words && Array.isArray(group.words)">
            <view v-for="(word, wordIndex) in group.words" :key="wordIndex" class="rel-word-item">
              <text class="rel-word">{{ word.hwd || '' }}</text>
              <text class="rel-tran">{{ word.tran || '' }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 同近义词区 - 白色卡片 -->
    <view v-if="showSyno && synos.length > 0" class="section-card">
      <view class="section-header" @click="synoExpanded = !synoExpanded">
        <text class="section-title">同近义词</text>
        <text class="toggle-icon">{{ synoExpanded ? '▼' : '▶' }}</text>
      </view>
      <view v-show="synoExpanded" class="section-content">
        <view v-for="(syno, index) in synos" :key="index" class="syno-group">
          <view class="syno-header">
            <text class="syno-pos">{{ syno.pos || '' }}</text>
            <text class="syno-tran">{{ syno.tran || '' }}</text>
          </view>
          <view class="syno-words" v-if="syno.hwds && Array.isArray(syno.hwds)">
            <text v-for="(hwd, hwdIndex) in syno.hwds" :key="hwdIndex" class="syno-word">
              {{ hwd.w || '' }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.word-card-box {
  // padding: 32rpx;
  margin: 20rpx;
}

// 单词头部 - 无白色背景
.word-header {
  margin-bottom: 24rpx;
  
  .english-word {
    font-size: 48rpx;
    font-weight: bold;
    color: #333;
    display: block;
    margin-bottom: 16rpx;
  }
  
  .phonetic-box {
    display: flex;
    gap: 24rpx;
    
    .phonetic-item {
      display: flex;
      align-items: center;
      gap: 8rpx;
      padding: 8rpx 16rpx;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 8rpx;
      
      .phonetic-label {
        font-size: 24rpx;
        color: #999;
      }
      
      .phonetic-text {
        font-size: 28rpx;
        color: #666;
      }
      
      .audio-icon {
        font-size: 28rpx;
      }
    }
  }
}

// 通用卡片样式
.section-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;
    
    .section-title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
    }
    
    .toggle-icon {
      font-size: 24rpx;
      color: #999;
    }
  }
  
  .section-content {
    // 使用 gap 统一管理列表项间距
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    
    .sentence-item,
    .phrase-item,
    .rel-word-item {
      padding: 16rpx;
      background: #fafafa;
      border-radius: 8rpx;
      
      .sentence-en {
        display: block;
        font-size: 28rpx;
        color: #333;
        margin-bottom: 8rpx;
        line-height: 1.6;
        
        .highlight-word {
          color: #409eff;
          font-weight: bold;
          background: linear-gradient(to bottom, transparent 60%, rgba(64, 158, 255, 0.2) 60%);
          padding: 0 2rpx;
        }
      }
      
      .sentence-cn,
      .phrase-en,
      .rel-word {
        display: block;
        font-size: 28rpx;
        color: #333;
        margin-bottom: 8rpx;
        line-height: 1.6;
      }
      
      .sentence-cn,
      .phrase-cn,
      .rel-tran {
        display: block;
        font-size: 26rpx;
        color: #666;
        line-height: 1.6;
      }
    }
    
    // 同根词组使用 gap 管理间距
    .rel-group {
      display: flex;
      flex-direction: column;
      gap: 12rpx;
      
      .rel-pos {
        display: inline-block;
        font-size: 24rpx;
        color: #fff;
        background: #67c23a;
        padding: 4rpx 12rpx;
        border-radius: 4rpx;
        align-self: flex-start;
      }
      
      .rel-words-list {
        display: flex;
        flex-direction: column;
        gap: 12rpx;
      }
    }
    
    // 同近义词组使用 gap 管理间距
    .syno-group {
      display: flex;
      flex-direction: column;
      gap: 12rpx;
      
      .syno-header {
        display: flex;
        align-items: center;
        gap: 12rpx;
        
        .syno-pos {
          font-size: 24rpx;
          color: #fff;
          background: #e6a23c;
          padding: 4rpx 12rpx;
          border-radius: 4rpx;
        }
        
        .syno-tran {
          font-size: 26rpx;
          color: #666;
        }
      }
      
      .syno-words {
        display: flex;
        flex-wrap: wrap;
        gap: 12rpx;
        
        .syno-word {
          font-size: 28rpx;
          color: #409eff;
          padding: 6rpx 16rpx;
          background: #ecf5ff;
          border-radius: 6rpx;
        }
      }
    }
  }
}

// 翻译区（在白色卡片内）
.translation-section {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  
  .translation-item {
    display: flex;
    align-items: flex-start;
    gap: 12rpx;
    
    .pos-tag {
      font-size: 24rpx;
      color: #fff;
      background: #409eff;
      padding: 4rpx 12rpx;
      border-radius: 4rpx;
      flex-shrink: 0;
    }
    
    .translation-text {
      font-size: 30rpx;
      color: #333;
      line-height: 1.6;
    }
  }
}
</style>