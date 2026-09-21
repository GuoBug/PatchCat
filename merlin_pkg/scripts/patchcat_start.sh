#!/bin/sh
source /koolshare/scripts/base.sh
alias echo_date='echo 【$(TZ=UTC-8 date -R +%Y年%m月%d日\ %X)】'

CONFIG_DIR="/jffs/configs/patchcat"
CONFIG_FILE="$CONFIG_DIR/config.json"
BIN_PATH="/koolshare/bin/patchcat-server"
STATIC_DIR="/koolshare/patchcat/dist"

PORT=$(dbus get patchcat_port)
[ -z "$PORT" ] && PORT="8899"

STORAGE_ENABLE=$(dbus get patchcat_storage_enable)
[ "$STORAGE_ENABLE" = "1" ] && STORAGE_BOOL=true || STORAGE_BOOL=false

STORAGE_PATH=$(dbus get patchcat_storage_path)
[ -z "$STORAGE_PATH" ] && STORAGE_PATH="/tmp/mnt/sda1/patchcat/data.db"

WAN_ENABLE=$(dbus get patchcat_wan)

mkdir -p "$CONFIG_DIR"

# 生成 JSON 配置文件
cat > "$CONFIG_FILE" <<EOF
{
  "server": {
    "host": "0.0.0.0",
    "port": $PORT
  },
  "proxy": {
    "enabled": true,
    "timeout_seconds": 180
  },
  "storage": {
    "enabled": $STORAGE_BOOL,
    "db_path": "$STORAGE_PATH"
  },
  "static_dir": "$STATIC_DIR"
}
EOF

# 杀掉可能存在的旧进程
killall patchcat-server >/dev/null 2>&1
ps | grep -E "httpd -p $PORT" | grep -v grep | awk '{print $1}' | xargs kill -9 >/dev/null 2>&1

# 优先启动 Go 网关，若不存在则优雅降级为系统自带的 busybox httpd 托管静态画布
if [ -f "$BIN_PATH" ] && [ -x "$BIN_PATH" ]; then
    echo_date "启动 PatchCat Go 网关 (含大模型代理与静态分发，端口: $PORT)..."
    nohup "$BIN_PATH" --config "$CONFIG_FILE" >/tmp/patchcat.log 2>&1 &
else
    echo_date "未检测到 patchcat-server 核心，自动启用系统内置轻量 Web 服务 (端口: $PORT)..."
    busybox httpd -p "$PORT" -h "$STATIC_DIR"
fi

# 处理防火墙规则
iptables -D INPUT -p tcp --dport "$PORT" -j ACCEPT >/dev/null 2>&1
if [ "$WAN_ENABLE" = "1" ]; then
    echo_date "开放 WAN 防火墙端口: $PORT"
    iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT
fi

echo_date "PatchCat 网关已成功启动！可通过局域网直接访问。"
