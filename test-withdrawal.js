const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000/api';
const TEST_CONFIG = {
  // 测试提现地址（使用有效的BSC地址格式）
  toAddress: '0xc840a8Abd9A8C8142c830DF1636c4b12B67A453E',
  // 提现金额（以wei为单位，这里是1 USDT用于测试）
  amount: '100000000000000000000',
  // 请求者标识
  requestedBy: 'test-script',
  // 用户ID（可选）
  userId: 'test_user_001'
};

// 工具函数：格式化USDT金额
function formatUSDT(weiAmount) {
  return (parseFloat(weiAmount) / Math.pow(10, 18)).toFixed(6);
}

// 工具函数：延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 工具函数：发送HTTP请求
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    throw error;
  }
}

// 1. 测试提现钱包信息
async function testWithdrawalWalletInfo() {
  console.log('\n🔍 1. 测试获取提现钱包信息...');

  const result = await apiRequest('GET', '/withdrawal/wallet/info');

  if (result.success) {
    console.log('✅ 提现钱包信息获取成功:', result.data);
  } else {
    console.log('❌ 获取提现钱包信息失败:', result.message);
  }

  return result;
}

// 2. 测试创建提现请求
async function testCreateWithdrawal() {
  console.log('\n💰 2. 测试创建提现请求...');
  console.log(`   目标地址: ${TEST_CONFIG.toAddress}`);
  console.log(`   提现金额: ${formatUSDT(TEST_CONFIG.amount)} USDT`);

  const result = await apiRequest('POST', '/withdrawal/create', {
    toAddress: TEST_CONFIG.toAddress,
    amount: TEST_CONFIG.amount,
    requestedBy: TEST_CONFIG.requestedBy,
    userId: TEST_CONFIG.userId
  });

  if (result.success) {
    console.log('✅ 提现请求创建成功:', result);
    return result.data.withdrawalRecord;
  } else {
    console.log('❌ 创建提现请求失败:', result.message);
    return null;
  }
}

// 3. 测试获取提现记录
async function testGetWithdrawalRecords() {
  console.log('\n📋 3. 测试获取提现记录...');

  const result = await apiRequest('GET', '/withdrawal/records?page=1&limit=5');

  if (result.success) {
    console.log('✅ 提现记录获取成功:');
    console.log(`   总记录数: ${result.data.total}`);
    console.log(`   当前页记录: ${result.data.records.length}`);

    if (result.data.records.length > 0) {
      console.log('\n   最近的提现记录:');
      result.data.records.slice(0, 3).forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record._id}`);
        console.log(`      金额: ${record.amountFormatted} USDT`);
        console.log(`      状态: ${record.status}`);
        console.log(`      目标地址: ${record.toAddress}`);
        console.log(`      创建时间: ${new Date(record.createdAt).toLocaleString()}`);
        if (record.transactionHash) {
          console.log(`      交易哈希: ${record.transactionHash}`);
        }
        console.log('');
      });
    }
  } else {
    console.log('❌ 获取提现记录失败:', result.message);
  }

  return result;
}

// 4. 测试获取提现统计
async function testWithdrawalStatistics() {
  console.log('\n📊 4. 测试获取提现统计...');

  const result = await apiRequest('GET', '/withdrawal/statistics');

  if (result.success) {
    console.log('✅ 提现统计获取成功:');
    console.log(`   总提现次数: ${result.data.totalWithdrawals}`);
    console.log(`   待处理: ${result.data.pendingWithdrawals}`);
    console.log(`   处理中: ${result.data.processingWithdrawals}`);
    console.log(`   已完成: ${result.data.completedWithdrawals}`);
    console.log(`   已失败: ${result.data.failedWithdrawals}`);
    console.log(`   总提现金额: ${result.data.totalAmountWithdrawnFormatted} USDT`);
    console.log(`   今日提现次数: ${result.data.todayWithdrawals}`);
    console.log(`   今日提现金额: ${result.data.todayAmountWithdrawnFormatted} USDT`);
  } else {
    console.log('❌ 获取提现统计失败:', result.message);
  }

  return result;
}

// 5. 测试重试提现（如果有失败的提现）
async function testRetryWithdrawal(withdrawalId) {
  if (!withdrawalId) {
    console.log('\n⏭️  5. 跳过重试测试（没有提现ID）');
    return;
  }

  console.log('\n🔄 5. 测试重试提现...');
  console.log(`   提现ID: ${withdrawalId}`);

  const result = await apiRequest('POST', `/withdrawal/retry/${withdrawalId}`);

  if (result.success) {
    console.log('✅ 提现重试成功');
  } else {
    console.log('❌ 提现重试失败:', result.message);
  }

  return result;
}

// 6. 监控提现状态
async function monitorWithdrawalStatus(withdrawalId, maxAttempts = 10) {
  if (!withdrawalId) {
    console.log('\n⏭️  跳过状态监控（没有提现ID）');
    return;
  }

  console.log('\n👀 6. 监控提现状态变化...');
  console.log(`   提现ID: ${withdrawalId}`);

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000); // 等待3秒

    const result = await apiRequest('GET', '/withdrawal/records?page=1&limit=10');

    if (result.success) {
      const withdrawal = result.data.records.find(r => r._id === withdrawalId);

      if (withdrawal) {
        console.log(`   [${i + 1}/${maxAttempts}] 状态: ${withdrawal.status}`);

        if (withdrawal.status === 'completed') {
          console.log('✅ 提现已完成!');
          console.log(`   交易哈希: ${withdrawal.transactionHash}`);
          break;
        } else if (withdrawal.status === 'failed') {
          console.log('❌ 提现失败!');
          console.log(`   错误信息: ${withdrawal.errorMessage || '未知错误'}`);
          break;
        }
      } else {
        console.log('❌ 找不到提现记录');
        break;
      }
    }

    if (i === maxAttempts - 1) {
      console.log('⏰ 监控超时，请手动检查提现状态');
    }
  }
}

// 主测试函数
async function runWithdrawalTests() {
  console.log('🚀 开始提现功能测试...');
  console.log('='.repeat(50));

  try {
    // 1. 获取提现钱包信息
    const walletInfo = await testWithdrawalWalletInfo();

    // 检查钱包余额是否足够
    if (walletInfo.success) {
      const walletBalance = parseFloat(walletInfo.data.balance);
      const testAmount = parseFloat(TEST_CONFIG.amount);

      if (walletBalance < testAmount) {
        console.log(`\n⚠️  警告: 提现钱包余额不足!`);
        console.log(`   当前余额: ${formatUSDT(walletBalance.toString())} USDT`);
        console.log(`   测试金额: ${formatUSDT(TEST_CONFIG.amount)} USDT`);
        console.log('   建议降低测试金额或充值提现钱包');
      }
    }

    // 2. 创建提现请求
    const withdrawal = await testCreateWithdrawal();

    // 3. 获取提现记录
    await testGetWithdrawalRecords();

    // 4. 获取提现统计
    await testWithdrawalStatistics();

    // 5. 如果创建了提现，监控其状态
    if (withdrawal) {
      await monitorWithdrawalStatus(withdrawal._id);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 提现功能测试完成!');

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('💡 请确保BSC Scanner服务正在运行:');
      console.log('   pm2 status');
      console.log('   或');
      console.log('   npm run dev');
    }
  }
}

// 显示使用说明
function showUsage() {
  console.log('📖 提现测试脚本使用说明:');
  console.log('');
  console.log('1. 确保BSC Scanner服务正在运行');
  console.log('2. 修改脚本中的TEST_CONFIG配置:');
  console.log(`   - toAddress: 提现目标地址（当前: ${TEST_CONFIG.toAddress}）`);
  console.log(`   - amount: 提现金额（当前: ${formatUSDT(TEST_CONFIG.amount)} USDT）`);
  console.log('3. 确保提现钱包有足够的USDT余额');
  console.log('4. 运行测试: node test-withdrawal.js');
  console.log('');
}

// 如果直接运行此脚本
if (require.main === module) {
  // 检查命令行参数
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  // 运行测试
  runWithdrawalTests().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runWithdrawalTests,
  testWithdrawalWalletInfo,
  testCreateWithdrawal,
  testGetWithdrawalRecords,
  testWithdrawalStatistics,
  formatUSDT
};
