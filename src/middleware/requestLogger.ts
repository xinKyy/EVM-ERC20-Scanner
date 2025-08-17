import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const { method, url, ip } = req;
  
  // 记录请求开始
  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ip}`);

  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    console.log(
      `[${new Date().toISOString()}] ${method} ${url} - ${ip} - ${statusCode} - ${duration}ms`
    );
  });

  next();
};

export const corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Signature');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
};
