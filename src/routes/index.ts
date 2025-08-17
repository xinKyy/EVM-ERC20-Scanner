import { Router } from 'express';
import addressRoutes from './address';
import scannerRoutes from './scanner';
import transferRoutes from './transfer';

const router = Router();

// API路由
router.use('/address', addressRoutes);
router.use('/scanner', scannerRoutes);
router.use('/transfer', transferRoutes);

// 健康检查接口
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BSC USDT Scanner服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API信息接口
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BSC USDT充值检测服务',
    data: {
      name: 'BSC USDT Scanner',
      version: '1.0.0',
      description: '基于BSC链的USDT合约充值检测服务',
      features: [
        '支持配置RPC和ERC20Token地址',
        '使用MongoDB作为数据库',
        '支持地址订阅和去重',
        'USDT Transfer事件实时扫描',
        '6个区块确认机制',
        'Webhook通知功能',
        '漏块重扫机制',
      ],
      endpoints: {
        address: {
          subscribe: 'POST /api/address/subscribe',
          unsubscribe: 'POST /api/address/unsubscribe',
          list: 'GET /api/address/list',
          check: 'GET /api/address/check/:address',
          statistics: 'GET /api/address/statistics',
        },
        scanner: {
          status: 'GET /api/scanner/status',
          start: 'POST /api/scanner/start',
          stop: 'POST /api/scanner/stop',
          manualScan: 'POST /api/scanner/manual-scan',
          rescan: 'POST /api/scanner/rescan',
        },
        transfer: {
          statistics: 'GET /api/transfer/statistics',
          byAddress: 'GET /api/transfer/address/:address',
          byBlocks: 'GET /api/transfer/blocks',
          cleanup: 'POST /api/transfer/cleanup',
        },
      },
    },
  });
});

export default router;
