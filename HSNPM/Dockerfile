# 使用官方 Rust 镜像作为构建环境
FROM rust:1.70-slim AS builder

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 创建工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 构建发布版本
RUN cargo build --release

# 使用更小的运行时镜像
FROM debian:bullseye-slim

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    libssl1.1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd -m -u 1000 hsn

# 切换到非 root 用户
USER hsn

# 设置工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/target/release/hsnpm-notification-service /app/hsnpm-notification

# 复制环境变量文件（可被覆盖）
COPY --chown=hsn:hsn .env.example /app/.env.example

# 暴露端口
EXPOSE 3030

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3030/health || exit 1

# 启动命令
ENTRYPOINT ["/app/hsnpm-notification"]