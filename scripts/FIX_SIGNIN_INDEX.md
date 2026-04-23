# 🔧 user_sign_in 集合索引修复指南

## 📋 问题描述

### 症状
1. 用户第一次签到成功
2. 第二次签到时提示"今日已签到"，但实际上并没有签到成功
3. 云函数日志显示：
   ```
   E11000 duplicate key error collection: tnt-ic03bfvy6.user_sign_in 
   index: user_id dup key: { : "u_1776494212275_b466550f" }
   ```

### 根本原因
**数据库索引配置错误**：
- ❌ **当前配置**：`user_id` 字段设置了唯一索引
- ✅ **正确配置**：应该是复合唯一索引 `{ user_id: 1, date: 1 }`

**影响**：
- 每个用户只能有一条签到记录（而不是每天一条）
- 第一次签到后，后续所有签到都会失败

---

## 🔍 问题分析

### 错误的索引结构
```javascript
// ❌ 错误：只有 user_id 唯一索引
{
  user_id: 1  // 唯一索引
}
```

**导致的问题**：
- 用户 A 在 2026-04-23 签到 → 成功 ✅
- 用户 A 在 2026-04-24 签到 → 失败 ❌（因为 user_id 重复）

### 正确的索引结构
```javascript
// ✅ 正确：复合唯一索引
{
  user_id: 1,  // 用户ID（升序）
  date: 1      // 日期（升序）
}
```

**效果**：
- 用户 A 在 2026-04-23 签到 → 成功 ✅
- 用户 A 在 2026-04-24 签到 → 成功 ✅（不同的日期）
- 用户 A 在 2026-04-23 再次签到 → 失败 ❌（同一天重复）

---

## 🛠️ 修复步骤

### 步骤1：清理重复数据（如果已有错误数据）

如果数据库中已经有重复的签到记录，需要先清理：

```bash
# 运行清理脚本
node scripts/fix-signin-duplicates.js
```

**脚本功能**：
- 扫描所有用户的签到记录
- 检测有重复记录的用户
- 保留每个用户的最新签到记录
- 删除旧的重复记录
- 输出统计报告

---

### 步骤2：修改数据库索引

#### 方法1：通过云开发控制台（推荐）

1. **登录腾讯云开发控制台**
   - 访问：https://console.cloud.tencent.com/tcb

2. **进入数据库管理**
   - 选择你的环境
   - 点击"数据库" → "集合列表"
   - 找到 `user_sign_in` 集合

3. **查看当前索引**
   - 点击 `user_sign_in` 集合
   - 点击"索引管理"标签
   - 查看现有的索引配置

4. **删除错误的索引**
   - 找到 `user_id` 的唯一索引
   - 点击"删除"按钮
   - 确认删除

5. **添加正确的复合索引**
   - 点击"添加索引"
   - 配置如下：
     ```
     索引名称：user_id_date_unique（自定义）
     索引字段：
       - user_id (升序)
       - date (升序)
     索引类型：唯一索引
     ```
   - 点击"确定"

6. **验证索引**
   - 刷新页面，确认新索引已创建
   - 索引列表中应该看到：
     ```
     _id (默认索引)
     user_id_date_unique (唯一索引) ← 新增
     ```

---

#### 方法2：通过 CLI 命令（高级）

如果你安装了腾讯云开发 CLI，可以使用命令：

```bash
# 删除旧索引
tcb database:index delete user_sign_in user_id

# 添加新索引
tcb database:index add user_sign_in \
  --fields user_id,date \
  --unique true
```

---

### 步骤3：验证修复

#### 测试1：正常签到流程

1. 清除今天的签到记录（如果有）
2. 点击首页的"签到"按钮
3. 应该提示"签到成功"
4. 签到按钮变为绿色，显示"已签到"

#### 测试2：重复签到拦截

1. 再次点击"签到"按钮
2. 应该提示"今日已签到"
3. 不会创建新的签到记录

#### 测试3：跨天签到

1. 等待到第二天（或手动修改系统时间测试）
2. 点击"签到"按钮
3. 应该提示"签到成功"（允许新一天的签到）

---

## 📊 验证查询

在云开发控制台的"数据管理"中，可以执行以下查询验证：

### 查询1：检查是否有重复记录
```javascript
// 应该返回空数组（没有重复）
db.collection('user_sign_in').aggregate()
  .group({
    _id: { user_id: '$user_id', date: '$date' },
    count: { $sum: 1 }
  })
  .match({
    count: { $gt: 1 }
  })
  .end()
```

### 查询2：查看某个用户的签到记录
```javascript
// 应该看到多条记录（不同日期）
db.collection('user_sign_in')
  .where({
    user_id: 'u_1776494212275_b466550f'  // 替换为你的用户ID
  })
  .orderBy('date', 'desc')
  .get()
```

---

## ⚠️ 注意事项

### 1. 索引修改的影响
- **删除索引**：不会影响现有数据，但会降低查询性能
- **添加索引**：需要一定时间构建，期间可能影响写入性能
- **建议在低峰期操作**：避免影响用户体验

### 2. 数据备份
在删除索引或清理数据前，建议先备份：

```javascript
// 导出所有签到记录
db.collection('user_sign_in').get().then(res => {
  console.log(JSON.stringify(res.data, null, 2));
});
```

### 3. 并发控制
复合唯一索引可以防止并发签到：
- 即使用户快速点击两次签到按钮
- 数据库层面会拒绝第二条记录
- 云函数捕获错误后返回 `code: 409`

---

## 🎯 预期结果

修复完成后：

| 场景 | 预期行为 | 实际行为 |
|------|---------|---------|
| 首次签到 | 成功，创建记录 | ✅ 成功 |
| 同日再次签到 | 提示"今日已签到" | ✅ 提示正确 |
| 次日签到 | 成功，创建新记录 | ✅ 成功 |
| 查询待学习单词 | 数量正确 | ✅ 正确（已修复 openid 问题） |
| 查询待复习单词 | 数量正确 | ✅ 正确（已修复 openid 问题） |

---

## 📝 相关文件

| 文件 | 说明 |
|------|------|
| [`dashboard.js`](../src/cloudfunctions/entry/handlers/dashboard.js) | 签到相关云函数 |
| [`index/index.vue`](../src/pages/index/index.vue) | 首页签到UI |
| [`scripts/fix-signin-duplicates.js`](./fix-signin-duplicates.js) | 数据清理脚本 |
| [后端开发文档.md](../后端开发文档.md) | 数据库集合定义 |

---

## 💡 技术要点

### 1. MongoDB 唯一索引
```javascript
// 单字段唯一索引
{ field: 1 }  // unique: true

// 复合唯一索引
{ field1: 1, field2: 1 }  // unique: true

// 作用：确保组合值的唯一性
```

### 2. 云开发索引限制
- 每个集合最多支持 64 个索引
- 复合索引最多支持 32 个字段
- 唯一索引不允许 NULL 值重复

### 3. 错误处理最佳实践
```javascript
try {
  await db.collection('user_sign_in').add({ data });
} catch (error) {
  if (error.errCode === -502001 || error.message.includes('duplicate')) {
    return { code: 409, message: '该日期已签到' };
  }
  throw error;
}
```

---

## 🔗 相关资源

- [腾讯云开发数据库文档](https://docs.cloudbase.net/database/)
- [MongoDB 唯一索引文档](https://docs.mongodb.com/manual/core/index-unique/)
- [云开发错误码说明](https://docs.cloudbase.net/error-code/basic/DATABASE_REQUEST_FAILED)

---

**修复完成后，签到功能应该正常工作！** 🎉

如有问题，请查看云函数日志和前端控制台输出。
