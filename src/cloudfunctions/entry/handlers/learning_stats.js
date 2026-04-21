/**
 * 学习统计相关云函数 handlers
 * 包括：获取用户学习统计数据
 */

const dayjs = require('dayjs');

/**
 * 获取用户学习统计数据
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @param {Object} params.auth - 认证信息（包含 user_id）
 * @returns {Object} 统计数据
 */
async function getUserStatistics({ db, auth }) {
  const userId = auth.user.user_id;
  const today = dayjs().format('YYYY-MM-DD');
  
  try {
    // 1. 查询今日学习统计（如果没有数据，返回默认值0）
    const todayStats = await db.collection('user_learning_stats')
      .where({
        user_id: userId,
        date: today
      })
      .get();
    
    const todayLearned = todayStats.data.length > 0 ? (todayStats.data[0].learned_count || 0) : 0;
    const todayReviewed = todayStats.data.length > 0 ? (todayStats.data[0].reviewed_count || 0) : 0;
    
    // 2. 查询累计学习词数（汇总所有日期的 learned_count）
    // 如果没有数据，aggregate 返回空数组，需要处理这种情况
    const totalLearnedResult = await db.collection('user_learning_stats')
      .aggregate()
      .match({
        user_id: userId
      })
      .group({
        _id: null,
        total: db.command.aggregate.sum('$learned_count')
      })
      .end();
    
    // 如果没有任何学习记录，totalLearnedResult.list 为空数组
    const totalLearned = totalLearnedResult.list.length > 0 ? totalLearnedResult.list[0].total : 0;
    
    // 3. 查询累计学习天数（签到记录数）
    const signInCount = await db.collection('user_sign_in')
      .where({
        user_id: userId
      })
      .count();
    
    const totalDays = signInCount.total;
    
    return {
      code: 0,
      message: 'success',
      data: {
        todayLearned,
        todayReviewed,
        totalLearned,
        totalDays
      }
    };
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      code: 500,
      message: '获取统计数据失败',
      error: error.message
    };
  }
}

module.exports = {
  getUserStatistics
};
