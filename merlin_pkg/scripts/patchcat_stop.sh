#!/bin/sh
source /koolshare/scripts/base.sh
alias echo_date='echo 【$(TZ=UTC-8 date -R +%Y年%m月%d日\ %X)】'

echo_date "正在停止 PatchCat 服务..."
killall patchcat-server >/dev/null 2>&1

PORT=$(dbus get patchcat_port)
[ -z "$PORT" ] && PORT="8899"
ps | grep -E "httpd -p $PORT" | grep -v grep | awk '{print $1}' | xargs kill -9 >/dev/null 2>&1
iptables -D INPUT -p tcp --dport "$PORT" -j ACCEPT >/dev/null 2>&1

echo_date "PatchCat 服务已完全停止。"
