import { Router } from 'express';
import { AddressController } from '../controllers/AddressController';

const router = Router();
const addressController = new AddressController();

// 订阅地址
router.post('/subscribe', addressController.subscribe);

// 取消订阅地址
router.post('/unsubscribe', addressController.unsubscribe);

// 获取订阅的地址列表
router.get('/list', addressController.getAddresses);

// 检查地址订阅状态
router.get('/check/:address', addressController.checkSubscription);

// 获取订阅统计信息
router.get('/statistics', addressController.getStatistics);

export default router;
