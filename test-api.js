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

    // 3. 订阅测试地址
    console.log('\n3️⃣ 测试地址订阅...');
    const testAddresses = [
      '0x5a56b28F90eA1C0A425d80c4B449dFbA2b789C6a',
    ];

    const subscribeResult = await axios.post(`${BASE_URL}/address/subscribe`, {
      addresses: testAddresses
    });
    console.log('✅ 地址订阅成功:', subscribeResult.data.data);

    // 4. 获取地址列表
    console.log('\n4️⃣ 获取地址列表...');
    const addressList = await axios.get(`${BASE_URL}/address/list`);
    console.log('✅ 地址列表:', `共${addressList.data.data.pagination.total}个地址`);

    // 5. 检查地址订阅状态
    console.log('\n5️⃣ 检查地址订阅状态...');
    const checkResult = await axios.get(`${BASE_URL}/address/check/${testAddresses[0]}`);
    console.log('✅ 地址订阅状态:', checkResult.data.data);

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

    // 8. 获取地址统计
    console.log('\n8️⃣ 获取地址统计...');
    const addressStats = await axios.get(`${BASE_URL}/address/statistics`);
    console.log('✅ 地址统计:', addressStats.data.data);

    console.log('\n🎉 所有测试通过！服务运行正常。');

    // 使用示例
    console.log('\n📖 使用示例:');
    console.log('1. 启动扫描: POST /api/scanner/start');
    console.log('2. 添加监控地址: POST /api/address/subscribe');
    console.log('3. 查看扫描状态: GET /api/scanner/status');
    console.log('4. 查看转账记录: GET /api/transfer/address/YOUR_ADDRESS');

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
