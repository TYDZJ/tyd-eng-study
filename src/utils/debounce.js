/**
 * 防抖函数
 * @param {Function} callback - 需要防抖的回调函数
 * @param {number} delay - 延迟时间（毫秒），默认1000ms
 * @returns {Function} 防抖后的函数
 */
export function debounce(callback, delay = 1000) {
  let timer = null;
  
  return function(...args) {
    // 清除上一次的定时器
    if (timer !== null) {
      clearTimeout(timer);
    }
    
    // 设置新的定时器
    timer = setTimeout(() => {
      callback.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 创建一次性防抖函数（用于防止重复提交）
 * @param {Function} callback - 需要防抖的回调函数
 * @param {number} delay - 延迟时间（毫秒），默认1000ms
 * @returns {Function} 防抖后的函数
 */
export function createDebounceCallback(callback, delay = 1000) {
  let isExecuting = false;
  let timer = null;
  
  return async function(...args) {
    // 如果正在执行，直接返回
    if (isExecuting) {
      console.warn('操作正在进行中，请勿重复提交');
      return;
    }
    
    isExecuting = true;
    
    try {
      await callback.apply(this, args);
    } finally {
      // 延迟重置标志位，防止快速点击
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        isExecuting = false;
        timer = null;
      }, delay);
    }
  };
}
