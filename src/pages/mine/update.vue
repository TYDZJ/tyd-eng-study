<script setup>
import { ref, computed } from 'vue'
import TopNav from '@/components/top-nav.vue'
import { useUserStore } from '@/stores/user'
import { callEntryCloud } from '@/utils/wx-cloud-call'

const userStore = useUserStore()

// 用户信息显示状态
const isEditingNickname = ref(false)
const nickname = ref('')

// 密码相关
const showPasswordPopup = ref(false)
const passwordMode = ref('change') // 'reset' 重置密码, 'change' 修改密码, 'set' 设置密码
const passwordForm = ref({
  oldPassword: '',
  password: '',
  confirmPassword: ''
})
const showOldPassword = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// 判断用户是否已设置密码：优先使用后端 has_password，兼容老数据回退到账号类型判断。
const hasPassword = computed(() => {
  const profile = userStore.profile || {}
  if (typeof profile.has_password === 'boolean') {
    return profile.has_password
  }
  return Boolean(profile.user_type === 'account' && profile.username)
})

// 计算属性：显示的用户名
const displayName = computed(() => {
  const profile = userStore.profile
  if (!profile || !profile.username) {
    return '匿名用户'
  }
  return profile.username
})

// 开始编辑昵称
const startEditNickname = () => {
  nickname.value = displayName.value === '匿名用户' ? '' : displayName.value
  isEditingNickname.value = true
}

// 保存昵称
const saveNickname = async () => {
  if (!nickname.value.trim()) {
    uni.showToast({
      title: '请输入昵称',
      icon: 'none'
    })
    return
  }

  uni.showLoading({
    title: '保存中...'
  })

  try {
    // TODO: 调用后端接口更新昵称
    // const res = await callEntryCloud({
    //   action: "updateNickname",
    //   data: {
    //     nickname: nickname.value.trim()
    //   }
    // })
    
    // 暂时更新本地store
    if (userStore.profile) {
      userStore.profile.username = nickname.value.trim()
    }
    
    isEditingNickname.value = false
    
    uni.showToast({
      title: '保存成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('保存失败:', error)
    uni.showToast({
      title: error?.message || '保存失败',
      icon: 'error'
    })
  } finally {
    uni.hideLoading()
  }
}

// 取消编辑
const cancelEditNickname = () => {
  isEditingNickname.value = false
  nickname.value = ''
}

// 打开修改密码弹窗
const openPasswordPopup = () => {
  // 根据用户是否有密码决定默认模式
  passwordMode.value = hasPassword.value ? 'change' : 'set'
  passwordForm.value = {
    oldPassword: '',
    password: '',
    confirmPassword: ''
  }
  showOldPassword.value = false
  showPassword.value = false
  showConfirmPassword.value = false
  showPasswordPopup.value = true
}

// 切换密码模式（仅在重置和修改之间切换，设置密码不显示切换）
const togglePasswordMode = () => {
  if (passwordMode.value === 'set') return // 设置密码模式不允许切换
  passwordMode.value = passwordMode.value === 'reset' ? 'change' : 'reset'
  // 切换模式时清空表单
  passwordForm.value = {
    oldPassword: '',
    password: '',
    confirmPassword: ''
  }
  showOldPassword.value = false
  showPassword.value = false
  showConfirmPassword.value = false
}

// 关闭修改密码弹窗
const closePasswordPopup = () => {
  showPasswordPopup.value = false
}

// 切换密码显示/隐藏
const toggleOldPasswordVisibility = () => {
  showOldPassword.value = !showOldPassword.value
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const toggleConfirmPasswordVisibility = () => {
  showConfirmPassword.value = !showConfirmPassword.value
}

// 保存密码（根据模式调用不同接口）
const onSavePassword = async () => {
  // 验证旧密码（仅在修改密码模式下）
  if (passwordMode.value === 'change' && !passwordForm.value.oldPassword) {
    uni.showToast({
      title: '请输入旧密码',
      icon: 'none'
    })
    return
  }

  if (!passwordForm.value.password || !passwordForm.value.confirmPassword) {
    uni.showToast({
      title: '请填写完整信息',
      icon: 'none'
    })
    return
  }

  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    uni.showToast({
      title: '两次密码输入不一致',
      icon: 'none'
    })
    return
  }

  if (passwordForm.value.password.length < 6) {
    uni.showToast({
      title: '密码长度不能少于6位',
      icon: 'none'
    })
    return
  }

  const loadingText = passwordMode.value === 'reset' ? '重置中...' : 
                      passwordMode.value === 'set' ? '设置中...' : '保存中...'
  
  uni.showLoading({
    title: loadingText
  })

  try {
    let res
    if (passwordMode.value === 'reset') {
      // 忘记密码：走微信身份重置（公开 action，不依赖 session）。
      res = await callEntryCloud({
        action: "resetPasswordByWechat",
        password: passwordForm.value.password
      })
    } else if (passwordMode.value === 'set') {
      // 首次设置密码：仅在当前账号尚未设置密码时成功。
      res = await callEntryCloud({
        action: "setPassword",
        password: passwordForm.value.password
      })
    } else {
      // 修改密码：必须传 old_password，后端会校验旧密码哈希。
      res = await callEntryCloud({
        action: "changePassword",
        old_password: passwordForm.value.oldPassword,
        new_password: passwordForm.value.password
      })
    }
    
    const result = res?.result || {}
    if (result.code !== 0) {
      throw new Error(result.message || 
        (passwordMode.value === 'reset' ? "重置失败" : 
         passwordMode.value === 'set' ? "设置失败" : "修改失败"))
    }

    const successText = passwordMode.value === 'reset' ? '重置成功' : 
                        passwordMode.value === 'set' ? '设置成功' : '修改成功'
    
    uni.showToast({
      title: successText,
      icon: 'success'
    })

    if (userStore.profile) {
      userStore.profile.has_password = true
    }
    
    closePasswordPopup()
  } catch (error) {
    console.error(passwordMode.value === 'reset' ? '重置密码失败:' : 
                  passwordMode.value === 'set' ? '设置密码失败:' : '修改密码失败:', error)
    
    const errorText = passwordMode.value === 'reset' ? '重置失败' : 
                      passwordMode.value === 'set' ? '设置失败' : '修改失败'
    
    uni.showToast({
      title: error?.message || errorText,
      icon: 'error'
    })
  } finally {
    uni.hideLoading()
  }
}
</script>

<template>
  <view class="update-box">
    <top-nav title="账号信息" />
    
    <view class="update-content">
      <!-- 账号昵称 -->
      <view class="update-item">
        <view class="item-left">
          <text class="label">账号昵称：</text>
          <view v-if="!isEditingNickname" class="value-display">
            <text>{{ displayName }}</text>
          </view>
          <view v-else class="value-input">
            <input
              v-model="nickname"
              placeholder="请输入昵称"
              placeholder-class="input-placeholder"
              class="nickname-input"
            />
          </view>
        </view>
        <view class="item-right">
          <view v-if="!isEditingNickname" class="action-btn" @click="startEditNickname">
            <text>修改</text>
          </view>
          <view v-else class="action-buttons">
            <view class="action-btn cancel" @click="cancelEditNickname">
              <text>取消</text>
            </view>
            <view class="action-btn save" @click="saveNickname">
              <text>保存</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 登录密码 -->
      <view class="update-item">
        <view class="item-left">
          <text class="label">登录密码：</text>
          <view class="value-display">
            <text>{{ hasPassword ? '已设置' : '未设置' }}</text>
          </view>
        </view>
        <view class="item-right">
          <view class="action-btn" @click="openPasswordPopup">
            <text>{{ hasPassword ? '修改' : '设置' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 修改密码弹窗 -->
    <u-popup
      ref="popup"
      mode="bottom"
      :show="showPasswordPopup"
      @close="closePasswordPopup"
    >
      <view class="password-popup">
        <view class="popup-header">
          <text class="popup-title">{{ passwordMode === 'reset' ? '重置密码' : passwordMode === 'set' ? '设置密码' : '修改密码' }}</text>
          <view class="popup-close" @click="closePasswordPopup">
            <text>×</text>
          </view>
        </view>
        
        <view class="popup-content">
          <!-- 旧密码输入框（仅修改密码模式显示） -->
          <u-input 
            v-if="passwordMode === 'change'"
            v-model="passwordForm.oldPassword"
            :password="!showOldPassword"
            placeholder="请输入旧密码"
            border="surround"
            clearable
          >
            <template slot="suffix">
              <u-icon 
                :name="showOldPassword ? 'eye' : 'eye-off'" 
                size="20"
                color="#999"
                @click="toggleOldPasswordVisibility"
              ></u-icon>
            </template>
          </u-input>
          
          <!-- 新密码输入框 -->
          <u-input 
            v-model="passwordForm.password"
            :password="!showPassword"
            :placeholder="passwordMode === 'set' ? '请设置密码' : '请输入新密码'"
            border="surround"
            clearable
          >
            <template slot="suffix">
              <u-icon 
                :name="showPassword ? 'eye' : 'eye-off'" 
                size="20"
                color="#999"
                @click="togglePasswordVisibility"
              ></u-icon>
            </template>
          </u-input>
          
          <!-- 确认密码输入框 -->
          <u-input 
            v-model="passwordForm.confirmPassword"
            :password="!showConfirmPassword"
            :placeholder="passwordMode === 'set' ? '请确认密码' : '请确认新密码'"
            border="surround"
            clearable
          >
            <template slot="suffix">
              <u-icon 
                :name="showConfirmPassword ? 'eye' : 'eye-off'" 
                size="20"
                color="#999"
                @click="toggleConfirmPasswordVisibility"
              ></u-icon>
            </template>
          </u-input>
          
          <!-- 保存按钮 -->
          <button
            class="save-btn primary"
            @click="onSavePassword"
          >
            {{ passwordMode === 'reset' ? '重置密码' : passwordMode === 'set' ? '设置密码' : '保存' }}
          </button>
          
          <!-- 切换模式文字（设置密码模式不显示） -->
          <view v-if="passwordMode !== 'set'" class="mode-switch" @click="togglePasswordMode">
            <text>{{ passwordMode === 'reset' ? '修改密码' : '重置密码' }}</text>
          </view>
        </view>
      </view>
    </u-popup>
  </view>
</template>

<style scoped lang="scss">
.update-box {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.update-content {
  padding: 30rpx;
}

.update-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  padding: 30rpx;
  margin-bottom: 20rpx;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.item-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.label {
  font-size: 32rpx;
  color: #333;
  margin-right: 20rpx;
  white-space: nowrap;
}

.value-display {
  flex: 1;
  min-width: 0;
  
  text {
    font-size: 32rpx;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.value-input {
  flex: 1;
  min-width: 0;
}

.nickname-input {
  width: 100%;
  font-size: 32rpx;
  color: #333;
  border-bottom: 2rpx solid #667eea;
  padding: 10rpx 0;
}

.input-placeholder {
  color: #999;
}

.item-right {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-left: 20rpx;
}

.action-btn {
  padding: 12rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 8rpx;
  font-size: 28rpx;
  white-space: nowrap;
  
  &.cancel {
    background: #999;
    margin-right: 15rpx;
  }
  
  &.save {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
}

.action-buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
}

// 密码弹窗样式
.password-popup {
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 40rpx 30rpx;
  max-height: 80vh;
  overflow-y: auto;
}

.popup-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #e0e0e0;
}

.popup-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.popup-close {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: #999;
}

.popup-content {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.save-btn {
  width: 100%;
  height: 100rpx;
  background-color: #fff;
  border-radius: 12rpx;
  border: 1px solid #333;
  color: #333;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  
  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border: none;
  }
}

.mode-switch {
  text-align: center;
  margin-top: 30rpx;
  font-size: 28rpx;
  color: #667eea;
  text-decoration: underline;
  cursor: pointer;
}
</style>