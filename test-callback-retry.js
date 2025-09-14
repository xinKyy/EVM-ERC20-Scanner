const axios = require('axios');

const BASE_URL = 'http://localhost:7999/api';

async function testCallbackRetry() {
  console.log('🔄 测试提现回调重试机制\n');

  try {
    // 1. 创建一个提现请求
    console.log('1️⃣ 创建提现请求...');
    const createResponse = await axios.post(`${BASE_URL}/withdrawal/create`, {
      toAddress: '0xe962856664ed05cc0aace18ae83c444d75bfc9c6',
      amount: '1000000000000000000', // 1 USDT
      userId: 'test_callback_retry'
    });

    if (!createResponse.data.success) {
      console.error('❌ 创建提现请求失败:', createResponse.data.message);
      return;
    }

    const withdrawalId = createResponse.data.data.withdrawalId;
    console.log(`✅ 提现请求创建成功: ${withdrawalId}\n`);

    // 2. 等待提现处理完成
    console.log('2️⃣ 等待提现处理...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;

      const recordsResponse = await axios.get(`${BASE_URL}/withdrawal/records?page=1&limit=10`);
      if (recordsResponse.data.success) {
        const withdrawal = recordsResponse.data.data.records.find(r => r._id === withdrawalId);
        if (withdrawal) {
          console.log(`   [${attempts}/${maxAttempts}] 状态: ${withdrawal.status}`);
          if (withdrawal.status === 'completed') {
            completed = true;
            console.log(`✅ 提现处理完成: ${withdrawal.transactionHash}\n`);
          } else if (withdrawal.status === 'failed') {
            console.log('❌ 提现处理失败\n');
            return;
          }
        }
      }
    }

    if (!completed) {
      console.log('⏰ 等待提现处理超时\n');
      return;
    }

    // 3. 检查MongoDB中的待重试回调记录
    console.log('3️⃣ 检查回调重试记录...');
    console.log('由于回调URL配置为不可达地址，应该会创建重试记录');
    console.log('您可以通过以下方式检查MongoDB中的PendingCallback集合：');
    console.log('');
    console.log('MongoDB查询命令:');
    console.log(`db.pendingcallbacks.find({relatedId: "${withdrawalId}"}).pretty()`);
    console.log('');
    console.log('预期结果：');
    console.log('- 应该有2条记录（申请成功回调 + 提现成功回调）');
    console.log('- status: "pending"');
    console.log('- retryCount: 0');
    console.log('- nextRetryAt: 约30秒后的时间');
    console.log('- type: "withdrawal"');
    console.log('- transferStatus: "0" 和 "1"');
    console.log('');
    console.log('4️⃣ 重试机制验证：');
    console.log('- 系统会每30秒自动重试失败的回调');
    console.log('- 每次重试失败后，retryCount会增加');
    console.log('- nextRetryAt会更新为下次重试时间');
    console.log('- 最多重试20次后标记为failed');
    console.log('');
    console.log('🎉 测试完成！请观察PM2日志查看重试过程：');
    console.log('pm2 logs bsc-scanner | grep "回调重试"');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

testCallbackRetry();
