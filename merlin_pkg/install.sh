#!/bin/sh
# Entrypoint for Koolshare offline package installer
MODULE="patchcat"
DIR=$(cd $(dirname $0); pwd)

cp -rf $DIR/webs/* /koolshare/webs/
cp -rf $DIR/scripts/* /koolshare/scripts/
[ -d "$DIR/bin" ] && cp -rf $DIR/bin/* /koolshare/bin/
mkdir -p /koolshare/patchcat/dist
[ -d "$DIR/dist" ] && cp -rf $DIR/dist/* /koolshare/patchcat/dist/

mkdir -p /koolshare/webs/patchcat
[ -d "$DIR/dist" ] && cp -rf $DIR/dist/* /koolshare/webs/patchcat/

chmod +x /koolshare/scripts/patchcat_*.sh
[ -f "/koolshare/bin/patchcat-server" ] && chmod +x /koolshare/bin/patchcat-server

# 执行安装与注册
sh /koolshare/scripts/patchcat_install.sh
