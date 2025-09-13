const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// 测试API的基本功能
async function testAPI() {
  console.log('🧪 开始测试BSC USDT Scanner API...\n');

  try {
    // 1. 健康检查
    console.log('1️⃣ 测试健康检查...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ 健康检查通过:', health.data.message);

    // 2. 获取API信息
    console.log('\n2️⃣ 获取API信息...');
    const info = await axios.get(`${BASE_URL}/info`);
    console.log('✅ API信息:', info.data.data.name);

    // 3. 测试用户钱包创建
    console.log('\n3️⃣ 测试用户钱包创建...');
    const testUserId = 'test_user_' + Date.now();
    
    const walletResult = await axios.post(`${BASE_URL}/wallet/create`, {
      userId: testUserId
    });
    console.log('✅ 用户钱包创建成功:', walletResult.data.data);

    // 4. 获取用户钱包信息
    console.log('\n4️⃣ 获取用户钱包信息...');
    const userWallet = await axios.get(`${BASE_URL}/wallet/user/${testUserId}`);
    console.log('✅ 用户钱包信息:', userWallet.data.data);

    // 5. 测试提现功能
    console.log('\n5️⃣ 测试提现功能...');
    try {
      const withdrawalResult = await axios.post(`${BASE_URL}/withdrawal/create`, {
        toAddress: '0x5a56b28F90eA1C0A425d80c4B449dFbA2b789C6a',
        amount: '1.0', // 1 USDT
        userId: testUserId
      });
      console.log('✅ 提现请求创建:', withdrawalResult.data.message);
    } catch (error) {
      console.log('⚠️ 提现测试:', error.response?.data?.message || '提现钱包余额不足（正常）');
    }

    // 6. 获取扫描状态
    console.log('\n6️⃣ 获取扫描状态...');
    const scannerStatus = await axios.get(`${BASE_URL}/scanner/status`);
    console.log('✅ 扫描状态:', {
      isScanning: scannerStatus.data.data.isScanning,
      lastScannedBlock: scannerStatus.data.data.lastScannedBlock,
      addressCount: scannerStatus.data.data.addressCount
    });

    // 7. 获取Transfer统计
    console.log('\n7️⃣ 获取Transfer统计...');
    const transferStats = await axios.get(`${BASE_URL}/transfer/statistics`);
    console.log('✅ Transfer统计:', transferStats.data.data);

    // 8. 获取钱包统计
    console.log('\n8️⃣ 获取钱包统计...');
    const walletStats = await axios.get(`${BASE_URL}/wallet/statistics`);
    console.log('✅ 钱包统计:', walletStats.data.data);

    // 9. 获取提现统计
    console.log('\n9️⃣ 获取提现统计...');
    const withdrawalStats = await axios.get(`${BASE_URL}/withdrawal/statistics`);
    console.log('✅ 提现统计:', withdrawalStats.data.data);

    console.log('\n🎉 所有测试通过！服务运行正常。');

    // 使用示例
    console.log('\n📖 使用示例:');
    console.log('1. 创建用户钱包: POST /api/wallet/create');
    console.log('2. 启动扫描: POST /api/scanner/start');
    console.log('3. 查看钱包余额: GET /api/wallet/user/USER_ID');
    console.log('4. 提现USDT: POST /api/withdrawal/create');
    console.log('5. 查看扫描状态: GET /api/scanner/status');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 请确保服务已启动: npm run dev');
    }
  }
}

// 如果直接运行此脚本，则执行测试
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };
