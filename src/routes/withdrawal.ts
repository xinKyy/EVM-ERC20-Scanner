import { Router } from 'express';
import { WithdrawalController } from '../controllers/WithdrawalController';
import { withdrawalService } from './scanner';

const router = Router();
const withdrawalController = new WithdrawalController(withdrawalService);

// 创建提现请求
router.post('/create', withdrawalController.createWithdrawal);

// 获取提现记录列表
router.get('/records', withdrawalController.getWithdrawalRecords);

// 获取提现统计信息
router.get('/statistics', withdrawalController.getWithdrawalStatistics);

// 获取提现钱包信息
router.get('/wallet/info', withdrawalController.getWithdrawalWalletInfo);

// 重试失败的提现
router.post('/retry/:withdrawalId', withdrawalController.retryWithdrawal);

export default router;
