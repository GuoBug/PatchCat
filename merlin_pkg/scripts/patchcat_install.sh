#!/bin/sh
source /koolshare/scripts/base.sh
alias echo_date='echo 【$(TZ=UTC-8 date -R +%Y年%m月%d日\ %X)】'

echo_date "正在安装 PatchCat AI 编排网关插件..."

# 1. 停止旧版本运行
sh /koolshare/scripts/patchcat_stop.sh >/dev/null 2>&1

# 2. 复制二进制与静态资源至 /koolshare 目录
mkdir -p /koolshare/bin
mkdir -p /koolshare/patchcat/dist
mkdir -p /jffs/configs/patchcat

# 复制可执行文件并赋予执行权限
cp -rf /tmp/patchcat/bin/patchcat-server /koolshare/bin/
chmod +x /koolshare/bin/patchcat-server

mkdir -p /koolshare/webs/patchcat
[ -d "/tmp/patchcat/dist" ] && cp -rf /tmp/patchcat/dist/* /koolshare/patchcat/dist/
[ -d "/tmp/patchcat/dist" ] && cp -rf /tmp/patchcat/dist/* /koolshare/webs/patchcat/

# 复制页面与脚本
cp -rf /tmp/patchcat/webs/Module_patchcat.asp /koolshare/webs/
cp -rf /tmp/patchcat/scripts/patchcat_*.sh /koolshare/scripts/
chmod +x /koolshare/scripts/patchcat_*.sh

# 3. 注册开机启动软链接到 nat-start 和 post-mount
ln -sf /koolshare/scripts/patchcat_config.sh /koolshare/init.d/S99patchcat.sh

# 4. 初始化与注册软件中心 dbus 变量
dbus set patchcat_version="0.4.7"
dbus set softcenter_module_patchcat_install="1"
dbus set softcenter_module_patchcat_name="patchcat"
dbus set softcenter_module_patchcat_title="PatchCat"
dbus set softcenter_module_patchcat_version="0.4.7"
dbus set softcenter_module_patchcat_description="专为 AI Builder 打造的 Prompt 拓扑编排网关"
dbus set softcenter_module_patchcat_home_url="Module_patchcat.asp"
[ -z "$(dbus get patchcat_port)" ] && dbus set patchcat_port="8899"
[ -z "$(dbus get patchcat_enable)" ] && dbus set patchcat_enable="1"
[ -z "$(dbus get patchcat_storage_enable)" ] && dbus set patchcat_storage_enable="0"
[ -z "$(dbus get patchcat_storage_path)" ] && dbus set patchcat_storage_path="/tmp/mnt/sda1/patchcat/data.db"

# 5. 清理安装临时目录
rm -rf /tmp/patchcat* >/dev/null 2>&1

# 6. 立即启动网关服务
if [ "$(dbus get patchcat_enable)" = "1" ]; then
    echo_date "正在启动 PatchCat 网关服务..."
    sh /koolshare/scripts/patchcat_start.sh
fi

echo_date "PatchCat 插件安装完成！默认访问端口为 8899。"
exit 0
