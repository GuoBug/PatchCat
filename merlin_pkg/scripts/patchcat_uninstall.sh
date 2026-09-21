#!/bin/sh
source /koolshare/scripts/base.sh
alias echo_date='echo 【$(TZ=UTC-8 date -R +%Y年%m月%d日\ %X)】'

echo_date "正在卸载 PatchCat AI 编排网关插件..."

# 停止服务
sh /koolshare/scripts/patchcat_stop.sh >/dev/null 2>&1

# 清理自启链接
rm -rf /koolshare/init.d/S99patchcat.sh >/dev/null 2>&1

# 清理安装文件
rm -rf /koolshare/bin/patchcat-server >/dev/null 2>&1
rm -rf /koolshare/patchcat >/dev/null 2>&1
rm -rf /koolshare/webs/patchcat >/dev/null 2>&1
rm -rf /koolshare/webs/Module_patchcat.asp >/dev/null 2>&1
rm -rf /koolshare/scripts/patchcat_*.sh >/dev/null 2>&1

# 清理 dbus 变量
dbus remove patchcat_enable
dbus remove patchcat_version
dbus remove patchcat_port
dbus remove patchcat_wan
dbus remove patchcat_storage_enable
dbus remove patchcat_storage_path
dbus remove softcenter_module_patchcat_install
dbus remove softcenter_module_patchcat_version
dbus remove softcenter_module_patchcat_title
dbus remove softcenter_module_patchcat_description

echo_date "PatchCat 插件卸载成功！配置文件保留在 /jffs/configs/patchcat 以防误删。"
exit 0
