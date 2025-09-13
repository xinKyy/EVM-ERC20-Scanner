import { Router } from 'express';
import { ScannerController } from '../controllers/ScannerController';
import { ScannerService } from '../services/ScannerService';
import { WithdrawalService } from '../services/WithdrawalService';

const router = Router();

// 创建单例服务实例
const scannerService = new ScannerService();
const withdrawalService = new WithdrawalService();
const scannerController = new ScannerController(scannerService);

// 获取扫描状态
router.get('/status', scannerController.getStatus);

// 启动扫描服务
router.post('/start', scannerController.startScanning);

// 停止扫描服务
router.post('/stop', scannerController.stopScanning);

// 手动触发扫描
router.post('/manual-scan', scannerController.manualScan);

// 重扫指定区块范围
router.post('/rescan', scannerController.rescanBlocks);

export { scannerService, withdrawalService };
export default router;
