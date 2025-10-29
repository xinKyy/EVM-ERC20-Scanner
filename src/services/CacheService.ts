/**
 * 内存缓存服务
 * 减少重复的数据库查询，提高性能
 */
export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, { data: any; expiry: number }>;
  private maxSize: number = 10000; // 最大缓存条目数
  private defaultTTL: number = 5 * 60 * 1000; // 默认5分钟过期

  private constructor() {
    this.cache = new Map();
    this.startCleanupTimer();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttl 过期时间（毫秒），默认5分钟
   */
  public set(key: string, data: any, ttl: number = this.defaultTTL): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存数据或null
   */
  public get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键
   * @returns 是否存在
   */
  public has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取或设置缓存（如果不存在则执行回调函数）
   * @param key 缓存键
   * @param callback 获取数据的回调函数
   * @param ttl 过期时间
   * @returns 缓存数据
   */
  public async getOrSet<T>(
    key: string, 
    callback: () => Promise<T>, 
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.get(key);
    
    if (cached !== null) {
      return cached;
    }

    const data = await callback();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // 可以添加命中率统计
    };
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    // 每分钟清理一次过期缓存
    setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000);
  }

  /**
   * 清理过期的缓存条目
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个过期缓存条目`);
    }
  }

  /**
   * 生成地址列表的缓存键
   * @param addresses 地址列表
   * @param prefix 前缀
   * @returns 缓存键
   */
  public static generateAddressKey(addresses: string[], prefix: string = ''): string {
    const sortedAddresses = addresses.sort().join(',');
    const hash = require('crypto').createHash('md5').update(sortedAddresses).digest('hex');
    return `${prefix}:${hash}`;
  }
}
