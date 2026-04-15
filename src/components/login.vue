<script setup>
import { ref } from 'vue';
import { callEntryCloud } from "@/utils/wx-cloud-call";
import { useUserStore } from "@/stores/user";

const emit = defineEmits(['success'])
const userStore = useUserStore();

// 当前模式：'login'、'passwordLogin' 或 'register'
const mode = ref('login');

// 表单数据
const formData = ref({
  username: '',
  password: '',
  confirmPassword: ''
});

// 切换模式
const toggleMode = () => {
  mode.value = mode.value === 'login' ? 'register' : 'login';
  // 切换时清空表单
  formData.value = {
    username: '',
    password: '',
    confirmPassword: ''
  };
}

// 切换到密码登录模式
const switchToPasswordLogin = () => {
  mode.value = 'passwordLogin';
  formData.value = {
    username: '',
    password: '',
    confirmPassword: ''
  };
}

/**
 * 根据openId一键登录/注册
 */
const onQuickLogin = async () => {
  uni.showLoading({
    title: 'Loading...'
  })

  try {
    const res = await callEntryCloud({
      action: "wxQuickLogin",
    });
    const result = res?.result || {};

    if (result.code !== 0) {
      throw new Error(result.message || "登录失败");
    }

    userStore.setAuthInfo(result?.data || {});
    if (!userStore.checkIsLoggedIn()) {
      throw new Error("登录失败：未获取到会话信息");
    }
    emit("success");
  } catch (error) {
    console.error('登录失败:', error)
    uni.showToast({
      title: error?.message || '登录失败',
      icon: 'error',
      duration: 2000
    })
  } finally {
    uni.hideLoading()
  }
}

/**
 * 账户密码登录
 */
const onPasswordLogin = async () => {
  if (!formData.value.username || !formData.value.password) {
    uni.showToast({
      title: '请输入账号和密码',
      icon: 'none'
    });
    return;
  }

  uni.showLoading({
    title: '登录中...'
  });

  try {
    const res = await callEntryCloud({
      action: "passwordLogin",
      data: {
        username: formData.value.username,
        password: formData.value.password
      }
    });
    
    const result = res?.result || {};
    if (result.code !== 0) {
      throw new Error(result.message || "登录失败");
    }

    userStore.setAuthInfo(result?.data || {});
    if (!userStore.checkIsLoggedIn()) {
      throw new Error("登录失败：未获取到会话信息");
    }
    
    emit("success");
  } catch (error) {
    console.error('登录失败:', error);
    uni.showToast({
      title: error?.message || '登录失败',
      icon: 'error',
      duration: 2000
    });
  } finally {
    uni.hideLoading();
  }
}

/**
 * 账户密码注册
 */
const onRegister = async () => {
  // 表单验证
  if (!formData.value.username || !formData.value.password || !formData.value.confirmPassword) {
    uni.showToast({
      title: '请填写完整信息',
      icon: 'none'
    });
    return;
  }

  if (formData.value.password !== formData.value.confirmPassword) {
    uni.showToast({
      title: '两次密码输入不一致',
      icon: 'none'
    });
    return;
  }

  if (formData.value.password.length < 6) {
    uni.showToast({
      title: '密码长度不能少于6位',
      icon: 'none'
    });
    return;
  }

  uni.showLoading({
    title: '注册中...'
  });

  try {
    const res = await callEntryCloud({
      action: "register",
      data: {
        username: formData.value.username,
        password: formData.value.password
      }
    });
    
    const result = res?.result || {};
    if (result.code !== 0) {
      throw new Error(result.message || "注册失败");
    }

    // 注册成功后自动登录
    userStore.setAuthInfo(result?.data || {});
    if (!userStore.checkIsLoggedIn()) {
      throw new Error("注册成功但登录失败");
    }
    
    emit("success");
  } catch (error) {
    console.error('注册失败:', error);
    uni.showToast({
      title: error?.message || '注册失败',
      icon: 'error',
      duration: 2000
    });
  } finally {
    uni.hideLoading();
  }
}
</script>

<template>
  <view class="login-box">
    <!-- 登录模式 -->
    <view v-if="mode === 'login'" class="login-mode">
      <button
        class="login-btn primary"
        @click="onQuickLogin"
      >
        微信一键登录/注册
      </button>
      <button
        class="login-btn"
        @click="switchToPasswordLogin"
      >
        账户密码登录
      </button>
      <view class="switch-mode" @click="toggleMode">
        切换为注册
      </view>
    </view>

    <!-- 密码登录模式 -->
    <view v-else-if="mode === 'passwordLogin'" class="password-login-mode">
      <input 
        class="input-field" 
        v-model="formData.username"
        type="text" 
        placeholder="请输入账号"
      />
      <input 
        class="input-field" 
        v-model="formData.password"
        type="password" 
        placeholder="请输入密码"
      />
      <button
        class="login-btn primary"
        @click="onPasswordLogin"
      >
        登录
      </button>
      <view class="switch-mode" @click="toggleMode">
        返回登录选项
      </view>
    </view>

    <!-- 注册模式 -->
    <view v-else class="register-mode">
      <input 
        class="input-field" 
        v-model="formData.username"
        type="text" 
        placeholder="请输入账号名称"
      />
      <input 
        class="input-field" 
        v-model="formData.password"
        type="password" 
        placeholder="请输入密码"
      />
      <input 
        class="input-field" 
        v-model="formData.confirmPassword"
        type="password" 
        placeholder="请确认密码"
      />
      <button
        class="login-btn primary"
        @click="onRegister"
      >
        注册
      </button>
      <view class="switch-mode" @click="toggleMode">
        切换为登录
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30rpx;
  padding: 30rpx 0;
}

.login-mode,
.password-login-mode,
.register-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30rpx;
}

.input-field {
  width: 80%;
  height: 100rpx;
  background-color: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 30rpx;
  font-size: 32rpx;
  color: #333;
  border: 1px solid #e0e0e0;
  
  &::placeholder {
    color: #999;
  }
}

.login-btn {
  width: 80%;
  height: 100rpx;
  background-color: #fff;
  border-radius: 12rpx;
  border: 1px solid #333;
  color: #333;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border: none;
  }
}

.switch-mode {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #667eea;
  text-decoration: underline;
  cursor: pointer;
}
</style>
