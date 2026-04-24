# 学习会话管理功能部署指南

## 📋 已完成的工作

### 1. 后端云函数（✅ 已完成）

#### 新增文件
- ✅ `src/cloudfunctions/entry/handlers/learning_session.js` - 学习会话管理核心逻辑（838行）

#### 修改文件
- ✅ `src/cloudfunctions/entry/lib/constants.js` - 添加4个新的错误码
- ✅ `src/cloudfunctions/entry/index.js` - 注册6个新接口
- ✅ `src/utils/wx-cloud-call.js` - 前端调用封装（7个新函数）

### 2. 实现的接口清单

| 接口名称 | 功能说明 | 状态 |
|---------|---------|------|
| `getOrCreateActiveSession` | 获取或创建活动会话（支持断点续学） | ✅ |
| `submitWordProgress` | 提交单词进度（幂等性保障） | ✅ |
| `finishSession` | 结束会话并统计今日学习数据 | ✅ |
| `getSessionState` | 获取会话详情（调试用） | ✅ |
| `abandonSession` | 放弃当前会话 | ✅ |
| `getTodayPlan` | 获取今日学习计划与配额 | ✅ |

### 3. 核心特性

- ✅ **SM2 记忆算法**：自动计算下次复习时间
- ✅ **幂等性保障**：基于 `request_id` 防止重复提交
- ✅ **断点续学**：running 状态会话优先返回
- ✅ **阶段约束**：学习模式（card→learn→spell）、复习模式（learn→spell）
- ✅ **并发控制**：同一用户+词书+模式仅允许1个活动会话
- ✅ **实时统计**：自动更新 `user_learning_stats`

---

## 🚀 部署步骤

### 第一步：配置数据库索引（⚠️ 必须完成）

在**腾讯云开发控制台** → **数据库** → 选择对应集合 → **索引管理**，创建以下索引：

#### 1. study_sessions 集合

**索引 1：查询活动会话（复合索引）**
```javascript
{
  "openid": 1,
  "book_id": 1,
  "mode": 1,
  "status": 1
}
```
- 类型：普通索引
- 用途：快速查找用户的 running 会话

**索引 2：历史会话排序**
```javascript
{
  "openid": 1,
  "created_at": -1
}
```
- 类型：普通索引
- 用途：按时间倒序查询历史会话

---

#### 2. study_session_word_progress 集合

**索引 1：唯一索引（⚠️ 重要）**
```javascript
{
  "session_id": 1,
  "word_id": 1
}
```
- 类型：**唯一索引 (unique: true)** ⚠️
- 用途：防止同一会话中重复记录同一单词

**索引 2：查询用户某会话的所有进度**
```javascript
{
  "openid": 1,
  "session_id": 1
}
```
- 类型：普通索引
- 用途：批量查询会话内所有单词进度

---

#### 3. study_logs 集合

**索引 1：唯一索引（⚠️ 幂等性保障）**
```javascript
{
  "request_id": 1
}
```
- 类型：**唯一索引 (unique: true)** ⚠️
- 用途：防止重复提交导致进度重复累计

**索引 2：查询某单词的提交记录**
```javascript
{
  "session_id": 1,
  "word_id": 1
}
```
- 类型：普通索引
- 用途：回放与分析特定单词的学习历史

---

#### 4. user_word_state 集合

**索引 1：唯一索引（⚠️ 重要）**
```javascript
{
  "openid": 1,
  "book_id": 1,
  "word_id": 1
}
```
- 类型：**唯一索引 (unique: true)** ⚠️
- 用途：确保每个用户对每个单词只有一条记忆状态记录

**索引 2：查询待复习单词**
```javascript
{
  "openid": 1,
  "next_review_at": 1
}
```
- 类型：普通索引
- 用途：快速获取需要复习的单词列表

---

### 第二步：上传云函数

#### 方法 1：使用微信开发者工具（推荐）

1. 打开**微信开发者工具**
2. 切换到 **"云开发"** 面板
3. 找到 `entry` 云函数
4. 右键点击 → **"上传并部署：云端安装依赖"**
5. 等待上传完成（约 10-30 秒）

#### 方法 2：使用 CLI

```bash
cd src/cloudfunctions/entry
npm install
tcb functions:deploy entry
```

---

### 第三步：验证部署

#### 测试 1：getOrCreateActiveSession

在微信开发者工具的 **"云开发"** → **"云函数"** → **"测试"** 中执行：

```json
{
  "action": "getOrCreateActiveSession",
  "book_id": "cet4",
  "mode": "learn",
  "session_size": 20
}
```

**预期返回**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session_id": "sess_1713849600000_abc123",
    "book_id": "cet4",
    "mode": "learn",
    "status": "running",
    "target_count": 20,
    "finished_count": 0,
    "current_stage": "card",
    "words": [
      {
        "_id": "apple",
        "word": "apple",
        "uk": "æpl",
        "us": "æpl",
        "translations": [...]
      }
    ],
    "progress_map": {
      "apple": {
        "card_done": false,
        "learn_done": false,
        "spell_done": false,
        "latest_rating": null
      }
    }
  }
}
```

---

#### 测试 2：submitWordProgress

使用上一步返回的 `session_id` 和第一个单词的 `_id`：

```json
{
  "action": "submitWordProgress",
  "session_id": "sess_1713849600000_abc123",
  "book_id": "cet4",
  "word_id": "apple",
  "stage": "card",
  "rating": "good",
  "cost_ms": 2000,
  "request_id": "test-uuid-123"
}
```

**预期返回**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session_id": "sess_1713849600000_abc123",
    "word_id": "apple",
    "word_progress": {
      "card_done": true,
      "learn_done": false,
      "spell_done": false,
      "latest_rating": null
    },
    "session_progress": {
      "finished_count": 0,
      "target_count": 20,
      "session_finished": false
    },
    "next_review_at": null
  }
}
```

---

#### 测试 3：幂等性验证

使用**相同的 `request_id`** 再次调用：

```json
{
  "action": "submitWordProgress",
  "session_id": "sess_1713849600000_abc123",
  "book_id": "cet4",
  "word_id": "apple",
  "stage": "card",
  "rating": "good",
  "cost_ms": 2000,
  "request_id": "test-uuid-123"
}
```

**预期返回**（不应重复计数）：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "is_duplicate": true,
    "message": "请求已处理",
    "session_id": "sess_1713849600000_abc123",
    "word_id": "apple"
  }
}
```

---

#### 测试 4：learn 阶段触发 SM2

```json
{
  "action": "submitWordProgress",
  "session_id": "sess_1713849600000_abc123",
  "book_id": "cet4",
  "word_id": "apple",
  "stage": "learn",
  "rating": "good",
  "cost_ms": 3000,
  "request_id": "test-uuid-456"
}
```

**预期返回**（应包含 `next_review_at`）：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session_id": "sess_1713849600000_abc123",
    "word_id": "apple",
    "word_progress": {
      "card_done": true,
      "learn_done": true,
      "spell_done": false,
      "latest_rating": "good"
    },
    "session_progress": {
      "finished_count": 0,
      "target_count": 20,
      "session_finished": false
    },
    "next_review_at": "2026-04-23T20:12:57.000Z"
  }
}
```

---

#### 测试 5：getTodayPlan

```json
{
  "action": "getTodayPlan",
  "book_id": "cet4"
}
```

**预期返回**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "book_id": "cet4",
    "today_new_quota": 20,
    "today_new_remaining": 20,
    "total_new_words": 100,
    "review_due_count": 0,
    "review_overdue_count": 0
  }
}
```

---

#### 测试 6：断点续学

1. 首次调用 `getOrCreateActiveSession`，记录返回的 `session_id`
2. 中途退出（不调用 `finishSession`）
3. 再次调用 `getOrCreateActiveSession`（相同参数）
4. **验证**：返回的 `session_id` 应与第一次相同，且 `progress_map` 保持之前的进度

---

## ⚠️ 注意事项

### 1. 数据库权限

确保以下集合的权限设置为 **"仅云函数可读写"**：
- ✅ `study_sessions`
- ✅ `study_session_word_progress`
- ✅ `study_logs`
- ✅ `user_word_state`
- ✅ `user_learning_stats`（如不存在需创建）
- ✅ `user_learn_settings`（如不存在需创建）

**设置路径**：云开发控制台 → 数据库 → 集合 → 权限设置

---

### 2. 依赖集合

确保以下集合已存在且有数据：
- ✅ `words` - 单词基础数据
- ✅ `book_words` - 词书与单词关联（含 `seq` 字段）
- ✅ `users` - 用户数据
- ✅ `wx_bindings` - 微信绑定关系

---

### 3. SM2 算法参数

当前实现使用的 SM2 参数：
- **初始值**：`ease_factor = 2.5`, `reps = 0`, `interval_days = 0`
- **范围限制**：`ease_factor ∈ [1.3, 2.5]`
- **间隔增长规则**：
  - `reps = 0` → `interval_days = 1`（1天后复习）
  - `reps = 1` → `interval_days = 6`（6天后复习）
  - `reps >= 2` → `interval_days = interval * ease_factor`

**评分映射**：
- `"again"` → q=0（遗忘，重置）
- `"hard"` → q=3（困难，小幅增长）
- `"good"` → q=4（良好，正常增长）
- `"easy"` → q=5（简单，大幅增长）

如需调整，修改 `learning_session.js` 中的 `updateSM2State` 函数。

---

### 4. 并发控制策略

采用 **"先失效后创建"** 策略：
- 当用户已有 `running` 会话时，直接返回该会话
- 不会主动创建多个 `running` 会话
- 如需强制创建新会话，先调用 `abandonSession` 放弃旧会话

---

### 5. 错误码对照表

| 错误码 | 含义 | 处理方式 |
|--------|------|---------|
| `0` | 成功 | - |
| `40001` | 参数错误 | 检查请求参数 |
| `40101` | 未登录/Token失效 | 跳转登录页 |
| `40402` | 会话不存在 | 重新创建会话 |
| `40403` | 单词不在会话中 | 检查 word_id |
| `40903` | 会话状态冲突 | 会话已结束，创建新会话 |
| `40904` | 阶段非法 | 检查 stage 参数 |
| `50001` | 服务异常 | 查看云函数日志 |

---

### 6. 性能优化建议

1. **批量查询**：使用 `_.in(word_ids)` 一次性获取多个单词
2. **冗余字段**：`study_session_word_progress` 中冗余 `openid` 和 `book_id`，避免联表
3. **索引命中**：确保所有查询都命中索引（特别是唯一索引）
4. **限制返回字段**：使用 `.field()` 只返回需要的字段
5. **异步并行**：独立的数据库操作使用 `Promise.all`

---

## 🧪 常见问题排查

### Q1：调用接口返回 `SESSION_NOT_FOUND`

**原因**：
- 会话 ID 错误
- 会话不属于当前用户
- 会话已被删除

**解决**：
- 检查 `session_id` 是否正确传递
- 确认用户已登录且 Token 有效
- 重新调用 `getOrCreateActiveSession` 创建新会话

---

### Q2：提交进度后 `finished_count` 未增加

**原因**：
- 单词未完成所有阶段（学习模式需 card+learn+spell 都完成）
- 复习模式需 learn+spell 都完成

**解决**：
- 检查 `progress_map` 中各阶段是否都为 `true`
- 确认会话模式（learn/review）

---

### Q3：幂等性不生效，重复计数

**原因**：
- `request_id` 未传递或每次不同
- `study_logs` 的唯一索引未配置

**解决**：
- 前端每次点击生成 UUID 并传递给后端
- 重试时使用相同的 `request_id`
- 检查数据库索引是否正确配置

---

### Q4：SM2 算法未触发

**原因**：
- `stage` 不是 `learn` 或 `spell`
- `rating` 为空

**解决**：
- 确保在 learn/spell 阶段提交时携带 `rating`
- card 阶段不会触发 SM2（符合设计）

---

### Q5：云函数部署后仍报错

**原因**：
- 未使用"云端安装依赖"部署
- 缓存未清除

**解决**：
1. 使用 **"上传并部署：云端安装依赖"**
2. 清除小程序端及开发者工具缓存
3. 重新编译小程序

---

## 📊 监控与维护

### 1. 日志查看

在云开发控制台 → 云函数 → entry → 日志，搜索关键字：
- `[getOrCreateActiveSession]`
- `[submitWordProgress]`
- `[finishSession]`

### 2. 数据统计

定期查询以下数据评估系统健康度：
```javascript
// 查询今日创建的会话数量
db.collection('study_sessions')
  .where({
    created_at: _.gte(new Date('2026-04-22')),
    status: 'running'
  })
  .count()

// 查询今日的提交日志数量
db.collection('study_logs')
  .where({
    created_at: _.gte(new Date('2026-04-22'))
  })
  .count()
```

### 3. 异常告警

建议设置以下告警规则：
- 云函数错误率 > 5%
- 平均响应时间 > 1000ms
- 唯一索引冲突次数 > 10次/小时

---

## ✅ 验收清单

部署完成后，逐项验证：

- [ ] 4 个数据库集合已创建
- [ ] 所有索引已配置（特别是 3 个唯一索引）
- [ ] 云函数已成功上传并部署
- [ ] `getOrCreateActiveSession` 能创建新会话
- [ ] 断点续学功能正常（返回同一 session_id）
- [ ] `submitWordProgress` 能正确更新进度
- [ ] 幂等性验证通过（相同 request_id 不重复计数）
- [ ] SM2 算法在 learn 阶段触发
- [ ] `finishSession` 能更新统计数据
- [ ] `getTodayPlan` 返回正确的配额信息
- [ ] 错误处理完善（参数错误、未登录等）

---

## 🎯 下一步计划

后端接口已完成，接下来需要：

1. **P2 - 前端页面改造**（预计 2-3 天）
   - 改造 `learn/index.vue` 主入口
   - 改造 `card.vue`、`learn.vue`、`spell.vue` 三个组件
   - 集成云函数调用

2. **P3 - 状态管理集成**（可选，预计 1 天）
   - 创建 Pinia Store
   - 统一管理会话状态

3. **P4 - 测试与优化**（预计 1-2 天）
   - 完整流程测试
   - 性能优化
   - Bug 修复

---

## 📞 技术支持

如遇问题，请提供以下信息：
1. 云函数日志截图
2. 请求参数与返回结果
3. 数据库集合截图（脱敏）
4. 复现步骤

祝部署顺利！🚀

---

## 📝 版本变更记录

### v1.1 - 2026-04-23（Spell 阶段调整为可选补充）

#### 🔧 核心变更
- **移除 Spell 阶段的后端支持**：`spell_done` 字段不再更新，仅保留用于数据兼容
- **调整会话完成条件**：学习模式只需 `card_done && learn_done`，复习模式只需 `learn_done`
- **前端流程优化**：Spell 变为可选补充练习，不计入后端进度统计

#### 📊 影响的文件
- `src/cloudfunctions/entry/handlers/learning_session.js`
  - 第 603 行：修改 `finishedCount` 计算逻辑，移除对 `spell_done` 的检查
  - 第 157 行：创建进度记录时仍包含 `spell_done: false`（向后兼容）
  
#### ⚠️ 索引配置说明
**本次更新不影响数据库索引配置**，原因：
1. 所有索引基于查询条件字段（`openid`、`session_id`、`word_id` 等），与业务字段无关
2. 数据库查询模式未变，`where` 条件仍然使用相同的字段组合
3. `spell_done` 字段可能仍存在于旧数据中，但后端不再更新它

**现有索引仍然有效**：
- ✅ `study_sessions`: `{ openid, book_id, mode, status }`、`{ openid, created_at }`
- ✅ `study_session_word_progress`: `{ session_id, word_id }` (唯一)、`{ openid, session_id }`
- ✅ `study_logs`: `{ request_id }` (唯一)、`{ session_id, word_id }`
- ✅ `user_word_state`: `{ openid, book_id, word_id }` (唯一)、`{ openid, next_review_at }`
- ✅ `user_learning_stats`: `{ openid, date }` (唯一)

#### 💡 数据兼容性
- **旧数据**：已存在的 `spell_done` 字段会保留，但不影响功能
- **新数据**：创建进度记录时仍包含 `spell_done: false`，但后续不会更新
- **前端适配**：前端代码应移除对 `spell_done` 的依赖，或将其视为可选字段

#### 🎯 验收标准
- ✅ Card 和 Learn 阶段正常完成并同步到云端
- ✅ 完成 `card_done && learn_done` 后会话标记为 finished
- ✅ Spell 阶段可在前端正常使用，但不更新后端进度
- ✅ 进度条正确反映 Card 和 Learn 的完成情况

---

### v1.0 - 2026-04-14（初始版本）

#### ✨ 新增功能
- 学习会话管理系统（断点续学、SM2 算法、幂等性保障）
- 6 个云函数接口
- 完整的数据库索引配置
- 三阶段学习流程（Card → Learn → Spell）

#### 📊 数据库集合
- `study_sessions` - 会话主表
- `study_session_word_progress` - 单词进度表
- `study_logs` - 学习日志（幂等性保障）
- `user_word_state` - 用户单词记忆状态
- `user_learning_stats` - 每日学习统计
