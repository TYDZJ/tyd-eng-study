/**
 * 词书设置相关云函数 handlers
 * 包括：获取用户当前词书、设置用户当前词书、获取词书列表
 */

const dayjs = require('dayjs');

// 词书库配置（可扩展为从数据库读取）
const BOOK_LIBRARY = [
  {
    book_id: 'cet4',
    book_name: '四级核心词汇',
    book_desc: '大学英语四级考试核心词汇',
    total_count: 2000,
    cover_color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    book_id: 'cet6',
    book_name: '六级核心词汇',
    book_desc: '大学英语六级考试核心词汇',
    total_count: 2500,
    cover_color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    book_id: 'kaoyan',
    book_name: '考研核心词汇',
    book_desc: '考研英语核心高频词汇',
    total_count: 3500,
    cover_color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    book_id: 'ielts',
    book_name: '雅思核心词汇',
    book_desc: '雅思考试必备核心词汇',
    total_count: 4000,
    cover_color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  }
];

/**
 * 获取词书列表
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @returns {Object} 词书列表
 */
async function getBookList({ db }) {
  try {
    return {
      code: 0,
      message: 'success',
      data: {
        books: BOOK_LIBRARY
      }
    };
  } catch (error) {
    console.error('获取词书列表失败:', error);
    return {
      code: 500,
      message: '获取词书列表失败',
      error: error.message
    };
  }
}

/**
 * 获取用户当前词书设置
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @param {Object} params.auth - 认证信息
 * @returns {Object} 词书设置
 */
async function getCurrentBook({ db, auth }) {
  const userId = auth.user.user_id;
  
  try {
    // 查询用户的词书设置
    const result = await db.collection('user_book_settings')
      .where({
        user_id: userId
      })
      .get();
    
    // 如果没有设置，返回 null（不自动初始化）
    if (result.data.length === 0) {
      return {
        code: 0,
        message: 'success',
        data: null
      };
    }
    
    return {
      code: 0,
      message: 'success',
      data: result.data[0]
    };
  } catch (error) {
    console.error('获取词书设置失败:', error);
    return {
      code: 500,
      message: '获取词书设置失败',
      error: error.message
    };
  }
}

/**
 * 设置用户当前词书
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @param {Object} params.auth - 认证信息
 * @param {Object} params.event - 事件对象
 * @returns {Object} 更新结果
 */
async function setCurrentBook({ db, auth, event }) {
  const userId = auth.user.user_id;
  const { book_id } = event;
  
  try {
    // 1. 验证必填参数
    if (!book_id) {
      return {
        code: 400,
        message: '请提供词书ID'
      };
    }
    
    // 2. 从词书库中查找词书信息
    const bookInfo = BOOK_LIBRARY.find(book => book.book_id === book_id);
    if (!bookInfo) {
      return {
        code: 404,
        message: '词书不存在'
      };
    }
    
    // 3. 构建更新数据
    const updateData = {
      book_id: bookInfo.book_id,
      book_name: bookInfo.book_name,
      book_desc: bookInfo.book_desc,
      total_count: bookInfo.total_count,
      learned_count: 0, // 切换词书时重置学习进度
      updated_at: new Date()
    };
    
    // 4. 使用 upsert 操作（存在则更新，不存在则创建）
    const queryResult = await db.collection('user_book_settings')
      .where({
        user_id: userId
      })
      .get();
    
    if (queryResult.data.length > 0) {
      // 更新现有记录
      await db.collection('user_book_settings')
        .doc(queryResult.data[0]._id)
        .update(updateData);
    } else {
      // 创建新记录
      await db.collection('user_book_settings').add({
        user_id: userId,
        ...updateData,
        created_at: new Date()
      });
    }
    
    return {
      code: 0,
      message: '词书设置成功',
      data: {
        user_id: userId,
        ...updateData
      }
    };
  } catch (error) {
    console.error('设置词书失败:', error);
    return {
      code: 500,
      message: '设置词书失败',
      error: error.message
    };
  }
}

/**
 * 更新词书学习进度
 * @param {Object} params - 参数对象
 * @param {Object} params.db - 数据库实例
 * @param {Object} params.auth - 认证信息
 * @param {Object} params.event - 事件对象
 * @returns {Object} 更新结果
 */
async function updateBookProgress({ db, auth, event }) {
  const userId = auth.user.user_id;
  const { learned_count } = event;
  
  try {
    // 1. 验证参数
    if (learned_count === undefined || learned_count === null) {
      return {
        code: 400,
        message: '请提供学习进度'
      };
    }
    
    if (typeof learned_count !== 'number' || learned_count < 0) {
      return {
        code: 400,
        message: '学习进度必须是非负整数'
      };
    }
    
    // 2. 查询当前词书设置
    const queryResult = await db.collection('user_book_settings')
      .where({
        user_id: userId
      })
      .get();
    
    if (queryResult.data.length === 0) {
      return {
        code: 404,
        message: '未找到词书设置，请先设置词书'
      };
    }
    
    // 3. 更新学习进度
    await db.collection('user_book_settings')
      .doc(queryResult.data[0]._id)
      .update({
        learned_count,
        updated_at: new Date()
      });
    
    return {
      code: 0,
      message: '学习进度更新成功',
      data: {
        learned_count
      }
    };
  } catch (error) {
    console.error('更新学习进度失败:', error);
    return {
      code: 500,
      message: '更新学习进度失败',
      error: error.message
    };
  }
}

module.exports = {
  getBookList,
  getCurrentBook,
  setCurrentBook,
  updateBookProgress
};
