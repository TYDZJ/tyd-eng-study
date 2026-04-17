# 登录/注册/密码链路修复说明

## 背景

本次修复目标是解决登录认证链路中的关键问题，包括：

- 注册 action 名不匹配导致的「未知 action」错误
- 前后端参数结构不一致导致的兼容性问题
- 账号信息页调试残留导致的 computed 只读赋值风险
- 密码流程（设置/修改/重置）的接口契约统一与安全校验补强

## 本次修改文件

- `src/components/login.vue`
- `src/cloudfunctions/entry/index.js`
- `src/cloudfunctions/entry/handlers/auth.js`
- `src/pages/mine/update.vue`
- `src/utils/wx-cloud-call.js`

## 具体改动

### 1) 注册 action 统一与兼容

#### 前端

- `src/components/login.vue`
  - 注册调用从 `action: "register"` 改为 `action: "passwordRegister"`。

#### 后端

- `src/cloudfunctions/entry/index.js`
  - 在 `actionMap` 中新增兼容映射：
    - `register: authHandlers.passwordRegister`
  - 保证旧调用不因 action 名变更直接失败。

### 2) 参数兼容层补强

#### 云函数 handler 增强

- `src/cloudfunctions/entry/handlers/auth.js`
  - 新增 `pickEventField(event, keys)`：
    - 支持优先读取 `event.<field>`
    - 兜底读取 `event.data.<field>`
  - 应用到以下流程：
    - `passwordRegister`：兼容读取 `username/password`
    - `passwordLogin`：兼容读取 `username/password`
    - `setPassword`：兼容读取 `password/new_password/newPassword`
    - `changePassword`：兼容读取 `old_password/oldPassword` 和 `new_password/newPassword/password`
    - `resetPasswordByWechat`：兼容读取 `password/new_password/newPassword`

#### 前端通用调用层

- `src/utils/wx-cloud-call.js`
  - 已存在并保留 payload 兼容展开：
    - `{ action, data: {...} }` 自动展开为顶层字段
  - 为受保护 action 自动补 `session_token`，减少漏传风险。

### 3) 密码流程契约统一

- `src/cloudfunctions/entry/index.js`
  - 注册 `changePassword: authHandlers.changePassword`。

- `src/cloudfunctions/entry/handlers/auth.js`
  - `setPassword` 仅允许“首次设置密码”：
    - 已有密码时返回 `PASSWORD_ALREADY_SET`
  - `changePassword` 增加强校验：
    - 必传旧密码与新密码
    - 校验旧密码哈希，不通过返回 `OLD_PASSWORD_INCORRECT`
  - `getAuthProfile` 返回 `has_password` 布尔值（不暴露敏感哈希）。

### 4) 页面调试残留清理

- `src/pages/mine/update.vue`
  - 删除测试入口：`hasPassword = false`
  - 避免对 `computed` 变量直接赋值引发运行时警告/错误。

## 关键兼容策略

- 兼容旧 action：后端保留 `register` 别名
- 兼容旧参数结构：
  - 调用层展开 `data`
  - 服务端双路径读取（顶层 + `data`）
- 兼容旧字段命名：
  - `old_password` / `oldPassword`
  - `new_password` / `newPassword` / `password`

## 回归检查结果（静态）

- 已确认前端不存在 `action: "register"` 调用
- 已确认后端存在 `register -> passwordRegister` 映射
- 已确认 `changePassword` 已注册到 `entry` 入口
- 已确认 `update.vue` 不再包含 `hasPassword = false` 调试入口
- 相关文件 lint 检查无新增错误

## 建议上线顺序

1. 先部署云函数（兼容 action + 参数兜底）
2. 再发布前端（统一 action 与页面清理）
3. 观察一个版本周期后，再评估是否移除后端兼容别名

## 风险提示

- 若 `auth_sessions` 集合存在除 `openid` 外的唯一索引（如 `user_id`），可能影响多会话策略，需要结合数据库索引规则复核。
- 参数兼容代码属于过渡方案，建议稳定后清理，降低长期维护成本。
