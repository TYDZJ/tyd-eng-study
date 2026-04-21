/**
 * 签到相关云函数 handlers
 * 包括：每日签到、补签、获取已签到日期列表
 */

const dayjs = require('dayjs');

/**
 * 每日签到
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @param {Object} params.auth - 认证信息
 * @param {Object} params.event - 事件对象
 * @returns {Object} 签到结果
 */
async function signIn({ db, auth, event }) {
  const userId = auth.user.user_id;
  const signDate = event.date || dayjs().format('YYYY-MM-DD');
  
  try {
    console.log(`[signIn] 开始签到:`, { userId, signDate });
    
    // 1. 验证日期格式
    if (!dayjs(signDate, 'YYYY-MM-DD', true).isValid()) {
      return {
        code: 400,
        message: '日期格式错误，应为 YYYY-MM-DD'
      };
    }
    
    // 2. 不允许对未来日期签到
    if (dayjs(signDate).isAfter(dayjs(), 'day')) {
      return {
        code: 400,
        message: '不能对未来日期签到'
      };
    }
    
    // 3. 检查是否已签到（利用唯一索引，如果重复会抛出错误）
    const existingSignIn = await db.collection('user_sign_in')
      .where({
        user_id: userId,
        date: signDate
      })
      .get();
    
    console.log(`[signIn] 查询已有记录:`, existingSignIn.data.length);
    
    if (existingSignIn.data.length > 0) {
      return {
        code: 409,
        message: '该日期已签到'
      };
    }
    
    // 4. 插入签到记录
    const now = new Date();
    const insertResult = await db.collection('user_sign_in').add({
      data: {  // ✅ 修复：必须使用 data 字段包裹
        user_id: userId,
        date: signDate,
        is_makeup: false,
        created_at: now,
        updated_at: now
      }
    });
    
    console.log(`[signIn] 插入成功:`, insertResult);
    
    return {
      code: 0,
      message: '签到成功',
      data: {
        date: signDate,
        isMakeup: false
      }
    };
  } catch (error) {
    console.error('[signIn] 签到失败:', error);
    
    // 如果是唯一索引冲突
    if (error.errCode === -502001 || error.message.includes('duplicate')) {
      return {
        code: 409,
        message: '该日期已签到'
      };
    }
    
    return {
      code: 500,
      message: '签到失败',
      error: error.message
    };
  }
}

/**
 * 补签
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @param {Object} params.auth - 认证信息
 * @param {Object} params.event - 事件对象
 * @returns {Object} 补签结果
 */
async function makeupSignIn({ db, auth, event }) {
  const userId = auth.user.user_id;
  const signDate = event.date;
  
  try {
    // 1. 验证日期参数
    if (!signDate) {
      return {
        code: 400,
        message: '请提供补签日期'
      };
    }
    
    if (!dayjs(signDate, 'YYYY-MM-DD', true).isValid()) {
      return {
        code: 400,
        message: '日期格式错误，应为 YYYY-MM-DD'
      };
    }
    
    // 2. 只能对过去的日期补签（不能是今天和未来）
    if (dayjs(signDate).isAfter(dayjs().subtract(1, 'day'), 'day')) {
      return {
        code: 400,
        message: '只能对过去的日期补签'
      };
    }
    
    // 3. 检查该日期是否已签到
    const existingSignIn = await db.collection('user_sign_in')
      .where({
        user_id: userId,
        date: signDate
      })
      .get();
    
    if (existingSignIn.data.length > 0) {
      return {
        code: 409,
        message: '该日期已签到'
      };
    }
    
    // 4. 插入补签记录
    const now = new Date();
    await db.collection('user_sign_in').add({
      user_id: userId,
      date: signDate,
      is_makeup: true,
      created_at: now,
      updated_at: now
    });
    
    return {
      code: 0,
      message: '补签成功',
      data: {
        date: signDate
      }
    };
  } catch (error) {
    console.error('补签失败:', error);
    
    // 如果是唯一索引冲突
    if (error.errCode === -502001 || error.message.includes('duplicate')) {
      return {
        code: 409,
        message: '该日期已签到'
      };
    }
    
    return {
      code: 500,
      message: '补签失败',
      error: error.message
    };
  }
}

/**
 * 获取已签到日期列表
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @param {Object} params.auth - 认证信息
 * @param {Object} params.event - 事件对象
 * @returns {Object} 已签到日期列表和有效期
 */
async function getSignedDates({ db, auth, event }) {
  const userId = auth.user.user_id;
  const startDate = event.startDate;
  const endDate = event.endDate;
  
  try {
    // 计算有效期范围
    let minDate, maxDate;
    
    if (startDate && endDate) {
      if (!dayjs(startDate, 'YYYY-MM-DD', true).isValid() || 
          !dayjs(endDate, 'YYYY-MM-DD', true).isValid()) {
        return {
          code: 400,
          message: '日期格式错误，应为 YYYY-MM-DD'
        };
      }
      minDate = startDate;
      maxDate = endDate;
    } else {
      // ✅ 默认逻辑：从今天往前推最多6个月
      maxDate = dayjs().format('YYYY-MM-DD');
      
      // 查询用户最早的签到记录
      const earliestRecord = await db.collection('user_sign_in')
        .where({
          user_id: userId
        })
        .orderBy('date', 'asc')
        .limit(1)
        .field({ date: true })
        .get();
      
      if (earliestRecord.data.length > 0) {
        // 如果有签到记录，从最早签到日期开始
        const firstSignDate = earliestRecord.data[0].date;
        const sixMonthsAgo = dayjs().subtract(5, 'month').format('YYYY-MM-DD');
        
        // 取较早的那个日期作为起始日期（确保不超过6个月范围）
        minDate = dayjs(firstSignDate).isBefore(sixMonthsAgo) ? sixMonthsAgo : firstSignDate;
      } else {
        // ✅ 如果没有签到记录，从今天开始算（首次使用）
        minDate = dayjs().format('YYYY-MM-DD');
        
        console.log(`用户 ${userId} 首次使用，初始化有效期为今天: ${minDate}`);
      }
    }
    
    // 构建查询条件
    const query = {
      user_id: userId,
      date: db.command.gte(minDate).and(db.command.lte(maxDate))
    };
    
    // 查询签到记录
    const result = await db.collection('user_sign_in')
      .where(query)
      .orderBy('date', 'asc')
      .field({
        date: true
      })
      .get();
    
    // 提取日期数组
    const dates = result.data.map(item => item.date);
    
    console.log(`用户 ${userId} 的签到记录查询结果:`, {
      查询范围: `${minDate} ~ ${maxDate}`,
      记录数量: dates.length,
      日期列表: dates,
      是否首次使用: dates.length === 0 && minDate === maxDate
    });
    
    return {
      code: 0,
      message: 'success',
      data: {
        dates,
        minDate,  // ✅ 返回有效期起始日期
        maxDate   // ✅ 返回有效期结束日期
      }
    };
  } catch (error) {
    console.error('获取已签到日期列表失败:', error);
    return {
      code: 500,
      message: '获取已签到日期列表失败',
      error: error.message
    };
  }
}

module.exports = {
  signIn,
  makeupSignIn,
  getSignedDates
};
