import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';

const router = Router();
const walletController = new WalletController();

// 为用户创建或获取钱包地址
router.post('/create', walletController.createOrGetWallet);

// 获取用户钱包信息
router.get('/user/:userId', walletController.getUserWallet);

// 手动触发用户钱包归集
router.post('/collect/:userId', walletController.collectUserWallet);

// 禁用用户钱包
router.post('/disable/:userId', walletController.disableUserWallet);

// 获取钱包统计信息
router.get('/statistics', walletController.getWalletStatistics);

// 获取归集统计信息
router.get('/collection/statistics', walletController.getCollectionStatistics);

export default router;
