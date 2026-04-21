# 仪表盘功能 - 数据库集合创建指南

## 📋 需要创建的数据库集合

在微信云开发控制台中，需要手动创建以下三个集合：

### 1. 用户签到记录集合 (`user_sign_in`)

**集合名称**: `user_sign_in`

**字段说明**:
```javascript
{
  _id: ObjectId,               // 自动生成
  user_id: String,             // 用户ID（必填）
  date: String,                // 签到日期，格式：YYYY-MM-DD（必填）
  is_makeup: Boolean,          // 是否为补签（默认false）
  created_at: Date,            // 创建时间
  updated_at: Date             // 更新时间
}
```

**索引配置** (重要！):
1. **普通索引**: `user_id` 
   - 用途：加速按用户查询
   - 方向：升序

2. **唯一复合索引**: `user_id + date`
   - 用途：确保同一用户同一天只能签到一次
   - 方向：都为升序
   - **必须设置为唯一索引** ⚠️

**创建步骤**:
1. 登录 [微信云开发控制台](https://console.cloud.tencent.com/tcb)
2. 选择你的云环境
3. 进入"数据库" → "集合列表"
4. 点击"添加集合"，输入集合名称：`user_sign_in`
5. 创建后，点击该集合 → "索引管理" → "添加索引"
6. 添加第一个索引：字段 `user_id`，类型"普通索引"
7. 添加第二个索引：字段 `user_id` 和 `date`，类型"唯一索引"

---

### 2. 用户学习统计集合 (`user_learning_stats`)

**集合名称**: `user_learning_stats`

**字段说明**:
```javascript
{
  _id: ObjectId,               // 自动生成
  user_id: String,             // 用户ID（必填）
  date: String,                // 统计日期，格式：YYYY-MM-DD（必填）
  learned_count: Number,       // 当日学习词数（默认0）
  reviewed_count: Number,      // 当日复习词数（默认0）
  created_at: Date,            // 创建时间
  updated_at: Date             // 更新时间
}
```

**索引配置**:
1. **普通索引**: `user_id`
   - 用途：加速按用户查询

2. **唯一复合索引**: `user_id + date`
   - 用途：确保同一用户同一天只有一条统计记录
   - **必须设置为唯一索引** ⚠️

**创建步骤**:
同上，创建集合 `user_learning_stats` 并配置相同的索引结构。

**注意**: 
- ✅ 当该集合没有数据时，接口会返回默认值 0，不会报错
- ✅ 学习统计数据应在学习模块完成后自动更新

---

### 3. 用户词书设置集合 (`user_book_settings`)

**集合名称**: `user_book_settings`

**字段说明**:
```javascript
{
  _id: ObjectId,               // 自动生成
  user_id: String,             // 用户ID（必填，唯一索引）
  book_id: String,             // 词书ID（必填），如 'cet4', 'cet6'
  book_name: String,           // 词书名称
  book_desc: String,           // 词书描述
  learned_count: Number,       // 已学习词数（默认0）
  total_count: Number,         // 总词数
  created_at: Date,            // 创建时间
  updated_at: Date             // 更新时间
}
```

**索引配置**:
1. **唯一索引**: `user_id`
   - 用途：确保每个用户只有一条词书记录，并加速查询
   - **必须设置为唯一索引** ⚠️

**创建步骤**:
1. 创建集合 `user_book_settings`
2. 添加唯一索引：字段 `user_id`

**初始化策略**:
- ✅ 采用"查询时自动初始化" (Upsert) 策略
- ✅ 在 `getCurrentBook` 接口中，若查询不到记录，则自动创建默认词书并返回
- ✅ 提高系统容错性，不阻塞用户首次使用

**默认词书配置**:
```javascript
{
  book_id: 'cet4',
  book_name: '四级核心词汇',
  book_desc: '大学英语四级考试核心词汇',
  learned_count: 0,
  total_count: 2000
}
```

---

## 🔧 云函数部署

### 部署步骤

1. **安装依赖**
   ```bash
   cd src/cloudfunctions/entry
   npm install
   ```

2. **上传并部署**
   - 在微信开发者工具中，右键点击 `src/cloudfunctions/entry` 文件夹
   - 选择"上传并部署：云端安装依赖"
   - 等待部署完成

3. **验证部署**
   - 在云开发控制台 → "云函数" 中查看 `entry` 函数
   - 确认版本号和更新时间

---

## 🧪 测试接口

### 测试 getUserStatistics

```javascript
wx.cloud.callFunction({
  name: 'entry',
  data: {
    action: 'getUserStatistics'
  }
}).then(res => {
  console.log('统计数据:', res.result);
  // 即使没有学习记录，也会返回：
  // { code: 0, data: { todayLearned: 0, todayReviewed: 0, totalLearned: 0, totalDays: 0 } }
});
```

### 测试 signIn

```javascript
wx.cloud.callFunction({
  name: 'entry',
  data: {
    action: 'signIn',
    date: '2024-01-15'  // 可选，默认为今天
  }
}).then(res => {
  console.log('签到结果:', res.result);
});
```

### 测试 makeupSignIn

```javascript
wx.cloud.callFunction({
  name: 'entry',
  data: {
    action: 'makeupSignIn',
    date: '2024-01-10'  // 必须是过去的日期
  }
}).then(res => {
  console.log('补签结果:', res.result);
});
```

### 测试 getSignedDates

```javascript
wx.cloud.callFunction({
  name: 'entry',
  data: {
    action: 'getSignedDates'
    // startDate: '2024-01-01',  // 可选
    // endDate: '2024-01-31'     // 可选
  }
}).then(res => {
  console.log('已签到日期:', res.result.data.dates);
});
```

### 测试 getCurrentBook

```javascript
wx.cloud.callFunction({
  name: 'entry',
  data: {
    action: 'getCurrentBook'
  }
}).then(res => {
  console.log('当前词书:', res.result.data);
  // 如果没有设置，会自动创建默认词书并返回
});
```

### 测试 setCurrentBook

```javascript
wx.cloud.callFunction({
  name: 'entry',
  data: {
    action: 'setCurrentBook',
    book_id: 'cet6',
    book_name: '六级核心词汇',
    book_desc: '大学英语六级考试核心词汇',
    total_count: 2500
  }
}).then(res => {
  console.log('词书设置结果:', res.result);
});
```

### 测试 updateBookProgress

```javascript
wx.cloud.callFunction({
  name: 'entry',
  data: {
    action: 'updateBookProgress',
    learned_count: 156
  }
}).then(res => {
  console.log('学习进度更新结果:', res.result);
});
```

---

## ⚠️ 注意事项

1. **权限配置**: 确保云函数的安全规则允许已登录用户访问
2. **索引重要性**: 唯一索引是防止重复数据和保证查询性能的关键，务必正确配置
3. **日期格式**: 所有日期必须使用 `YYYY-MM-DD` 格式
4. **时区问题**: 云函数使用的是服务器时区（UTC+8），与小程序端保持一致
5. **空数据处理**: 
   - ✅ `user_learning_stats` 无数据时返回默认值 0
   - ✅ `user_book_settings` 无数据时自动初始化默认词书
6. **学习统计更新**: `user_learning_stats` 集合的数据需要在学习模块完成后自动更新（后续实现）

---

## 📊 数据流转示意

```
用户操作 → 小程序前端 → callEntryCloud → entry云函数
                                      ↓
                              分发到对应 handler
                              (dashboard / learning_stats / book_settings)
                                      ↓
                              读写数据库集合
                                      ↓
                              返回结果给前端
                                      ↓
                              更新UI显示
```

---

## 🎯 下一步

1. ✅ 创建数据库集合（3个）
2. ✅ 配置索引
3. ✅ 部署云函数
4. ✅ 测试各个接口
5. ⏳ 在学习模块中实现学习统计数据的自动更新
6. ⏳ 实现词书选择页面，调用 `setCurrentBook` 接口
