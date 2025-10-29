module.exports = {
  apps: [
    {
      name: 'bsc-scanner',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',

      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 7999,
      },

      // 开发环境
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // 生产环境
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // 日志配置
      log_file: './logs/scanner.log',
      out_file: './logs/scanner.log',
      error_file: './logs/scanner-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // 进程管理
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',        // 增加内存限制到4G
      
      // Node.js 内存优化参数
      node_args: [
        '--max-old-space-size=3584',   // 设置V8最大堆内存为3.5G
        '--optimize-for-size',         // 优化内存使用
        '--expose-gc',                 // 启用手动垃圾回收
        '--gc-interval=100'            // 更频繁的垃圾回收
      ],

      // 重启策略
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',

      // 其他配置
      kill_timeout: 5000,
      listen_timeout: 3000,

      // 忽略的文件/目录（如果启用watch）
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git'
      ],

      // 环境变量文件
      env_file: '.env'
    }
  ]
};
