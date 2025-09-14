const axios = require('axios');

// 快速测试配置
const BASE_URL = 'http://localhost:7999/api';

// 简单的API请求函数
async function api(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
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
    return { success: false, message: error.message };
  }
}

// 格式化USDT
const formatUSDT = (wei) => (parseFloat(wei) / 1e18).toFixed(6);

async function quickTest() {
  console.log('🚀 快速提现功能测试\n');

  // 1. 检查提现钱包
  console.log('1️⃣ 检查提现钱包信息...');
  const walletInfo = await api('GET', '/withdrawal/wallet/info');
  if (walletInfo.success) {
    console.log(`✅ 提现钱包: ${walletInfo.data.address}`);
    console.log(`💰 USDT余额: ${walletInfo.data.usdtBalanceFormatted} USDT`);
    console.log(`⛽ BNB余额: ${walletInfo.data.bnbBalanceFormatted} BNB\n`);
  } else {
    console.log(`❌ 获取钱包信息失败: ${walletInfo.message}\n`);
    return;
  }

  // 2. 获取提现统计
  console.log('2️⃣ 获取提现统计...');
  const stats = await api('GET', '/withdrawal/statistics');
  if (stats.success) {
    console.log(`📊 总提现: ${stats.data.totalWithdrawals} 次`);
    console.log(`✅ 已完成: ${stats.data.completedWithdrawals}`);
    console.log(`❌ 失败: ${stats.data.failedWithdrawals}`);
    console.log(`💸 总金额: ${stats.data.totalAmountWithdrawnFormatted} USDT\n`);
  }

  // 3. 获取最近提现记录
  console.log('3️⃣ 获取最近提现记录...');
  const records = await api('GET', '/withdrawal/records?page=1&limit=3');
  if (records.success && records.data.records.length > 0) {
    console.log('📋 最近3条提现记录:');
    records.data.records.forEach((record, i) => {
      console.log(`   ${i + 1}. ${record.amountFormatted} USDT → ${record.toAddress.slice(0, 10)}...`);
      console.log(`      状态: ${record.status} | 时间: ${new Date(record.createdAt).toLocaleString()}`);
      if (record.transactionHash) {
        console.log(`      交易: ${record.transactionHash.slice(0, 20)}...`);
      }
    });
  } else {
    console.log('📋 暂无提现记录');
  }

  console.log('\n🎉 快速测试完成!');
  console.log('\n💡 要创建测试提现，请运行: node test-withdrawal.js');
}

// 运行快速测试
quickTest().catch(console.error);
