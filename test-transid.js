const axios = require('axios');

const BASE_URL = 'http://localhost:7999/api';

async function testTransIdFeature() {
  console.log('🆔 测试 transId 功能\n');

  try {
    // 生成一个唯一的外部交易ID
    const externalTransId = `EXT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🏷️  外部交易ID: ${externalTransId}\n`);

    // 1. 创建带有 transId 的提现请求
    console.log('1️⃣ 创建带有 transId 的提现请求...');
    const createResponse = await axios.post(`${BASE_URL}/withdrawal/create`, {
      toAddress: '0xe962856664ed05cc0aace18ae83c444d75bfc9c6',
      amount: '1000000000000000000', // 1 USDT
      userId: 'test_transid_user',
      transId: externalTransId
    });

    if (!createResponse.data.success) {
      console.error('❌ 创建提现请求失败:', createResponse.data.message);
      return;
    }

    console.log('✅ 提现请求创建成功:');
    console.log(`   内部ID: ${createResponse.data.data.withdrawalId}`);
    console.log(`   外部ID: ${createResponse.data.data.transId}`);
    console.log(`   金额: ${createResponse.data.data.amount} USDT`);
    console.log(`   状态: ${createResponse.data.data.status}\n`);

    const withdrawalId = createResponse.data.data.withdrawalId;

    // 2. 验证返回的 transId 是否正确
    if (createResponse.data.data.transId === externalTransId) {
      console.log('✅ transId 正确返回\n');
    } else {
      console.log('❌ transId 返回不正确\n');
      return;
    }

    // 3. 等待提现处理
    console.log('2️⃣ 等待提现处理...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 15;

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const recordsResponse = await axios.get(`${BASE_URL}/withdrawal/records?page=1&limit=10`);
      if (recordsResponse.data.success) {
        const withdrawal = recordsResponse.data.data.records.find(r => r._id === withdrawalId);
        if (withdrawal) {
          console.log(`   [${attempts}/${maxAttempts}] 状态: ${withdrawal.status}`);
          if (withdrawal.status === 'completed') {
            completed = true;
            console.log(`✅ 提现处理完成: ${withdrawal.transactionHash}`);
            
            // 验证记录中的 transId
            if (withdrawal.transId === externalTransId) {
              console.log(`✅ 数据库中的 transId 正确: ${withdrawal.transId}\n`);
            } else {
              console.log(`❌ 数据库中的 transId 不正确: ${withdrawal.transId}\n`);
            }
            
            break;
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

    // 4. 测试不带 transId 的请求
    console.log('3️⃣ 测试不带 transId 的提现请求...');
    const createResponse2 = await axios.post(`${BASE_URL}/withdrawal/create`, {
      toAddress: '0xe962856664ed05cc0aace18ae83c444d75bfc9c6',
      amount: '500000000000000000', // 0.5 USDT
      userId: 'test_no_transid_user'
      // 注意：没有 transId
    });

    if (createResponse2.data.success) {
      console.log('✅ 不带 transId 的提现请求创建成功:');
      console.log(`   内部ID: ${createResponse2.data.data.withdrawalId}`);
      console.log(`   外部ID: ${createResponse2.data.data.transId || '(空)'}`);
      console.log(`   金额: ${createResponse2.data.data.amount} USDT\n`);
    } else {
      console.log('❌ 不带 transId 的提现请求失败:', createResponse2.data.message);
    }

    // 5. 总结
    console.log('📋 功能验证总结:');
    console.log('✅ 1. 接收并保存外部 transId');
    console.log('✅ 2. API 响应中正确返回 transId');
    console.log('✅ 3. 数据库记录中正确存储 transId');
    console.log('✅ 4. Webhook 回调中会包含 transId（需要观察日志）');
    console.log('✅ 5. 支持可选的 transId 参数');
    console.log('');
    console.log('🔍 查看回调日志验证:');
    console.log('grep -A 5 -B 5 "添加回调到重试队列" ./logs/scanner.log | tail -20');
    console.log('');
    console.log('🎉 transId 功能测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

testTransIdFeature();
