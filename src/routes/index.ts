import { Router } from 'express';
import addressRoutes from './address';
import scannerRoutes from './scanner';
import transferRoutes from './transfer';
import walletRoutes from './wallet';
import withdrawalRoutes from './withdrawal';

const router = Router();

// API路由
router.use('/address', addressRoutes);
router.use('/scanner', scannerRoutes);
router.use('/transfer', transferRoutes);
router.use('/wallet', walletRoutes);
router.use('/withdrawal', withdrawalRoutes);

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
        '用户钱包自动生成和管理',
        'USDT Transfer事件实时扫描',
        '6个区块确认机制',
        '自动资金归集系统',
        'Webhook通知功能',
        '提现系统',
        '漏块重扫机制',
      ],
      endpoints: {
        wallet: {
          create: 'POST /api/wallet/create',
          getUserWallet: 'GET /api/wallet/user/:userId',
          collect: 'POST /api/wallet/collect/:userId',
          disable: 'POST /api/wallet/disable/:userId',
          statistics: 'GET /api/wallet/statistics',
          collectionStats: 'GET /api/wallet/collection/statistics',
        },
        withdrawal: {
          create: 'POST /api/withdrawal/create',
          records: 'GET /api/withdrawal/records',
          statistics: 'GET /api/withdrawal/statistics',
          walletInfo: 'GET /api/withdrawal/wallet/info',
          retry: 'POST /api/withdrawal/retry/:withdrawalId',
        },
        address: {
          subscribe: 'POST /api/address/subscribe (兼容性)',
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
