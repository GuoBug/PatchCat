#!/bin/sh
source /koolshare/scripts/base.sh

ENABLE=$(dbus get patchcat_enable)

if [ "$ENABLE" = "1" ]; then
    sh /koolshare/scripts/patchcat_start.sh
else
    sh /koolshare/scripts/patchcat_stop.sh
fi
