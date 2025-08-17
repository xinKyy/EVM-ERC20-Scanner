import { Router } from 'express';
import { TransferController } from '../controllers/TransferController';

const router = Router();
const transferController = new TransferController();

// 获取Transfer统计信息
router.get('/statistics', transferController.getStatistics);

// 根据地址获取Transfer记录
router.get('/address/:address', transferController.getTransfersByAddress);

// 根据区块范围获取Transfer记录
router.get('/blocks', transferController.getTransfersByBlockRange);

// 清理过期的Transfer记录
router.post('/cleanup', transferController.cleanupOldTransfers);

export default router;
