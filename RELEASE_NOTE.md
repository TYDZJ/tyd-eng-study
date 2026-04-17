# Release Note - 登录认证链路修复

## 发布主题

登录/注册/密码链路稳定性与兼容性修复。

## 主要修复

- 修复注册失败问题：统一注册 action 为 `passwordRegister`，并在后端保留 `register` 兼容别名。
- 修复前后端参数结构不一致问题：兼容顶层字段与 `data` 嵌套字段。
- 修复密码修改安全问题：新增 `changePassword` 并校验旧密码。
- 修复账号信息页调试残留：移除对 computed 状态的测试赋值入口。
- 完善认证状态输出：`getAuthProfile` 返回 `has_password` 布尔态。

## 影响范围

- 登录页（微信登录、账号登录、账号注册）
- 账号信息页（设置密码、修改密码、微信重置密码）
- 云函数 `entry` 的认证相关 action 分发

## 兼容性说明

- 兼容旧前端调用：
  - 后端支持 `register` 与 `passwordRegister` 双 action
  - 后端兼容读取 `event.xxx` 与 `event.data.xxx`
  - 密码字段兼容 `old_password/oldPassword` 与 `new_password/newPassword/password`

## 测试重点

- 新用户注册成功；重复用户名返回 `USERNAME_ALREADY_EXISTS`
- 账号密码登录成功；错误密码返回 `INVALID_CREDENTIALS`
- 首次设置密码成功；已设置密码再次设置返回 `PASSWORD_ALREADY_SET`
- 修改密码旧密码错误返回 `OLD_PASSWORD_INCORRECT`
- 微信重置密码成功后可使用新密码登录
- 连续多次登录不出现“首次后无法再次登录”

## 发布建议

1. 先部署云函数 `entry`
2. 再发布前端
3. 观察一个版本周期后评估是否移除兼容别名
