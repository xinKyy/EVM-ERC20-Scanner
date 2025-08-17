import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('API错误:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // 默认错误状态码
  let statusCode = error.statusCode || 500;
  let message = error.message || '服务器内部错误';

  // 处理特定类型的错误
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = '请求参数验证失败';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = '无效的参数格式';
  } else if (error.code === '11000') {
    statusCode = 409;
    message = '数据已存在';
  } else if (error.name === 'MongoNetworkError') {
    statusCode = 503;
    message = '数据库连接失败';
  } else if (error.name === 'TimeoutError') {
    statusCode = 408;
    message = '请求超时';
  }

  // 生产环境不暴露详细错误信息
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    ...(isDevelopment && {
      error: {
        name: error.name,
        stack: error.stack,
        code: error.code,
      },
    }),
    timestamp: new Date().toISOString(),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `接口 ${req.method} ${req.url} 不存在`,
    data: null,
    timestamp: new Date().toISOString(),
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
