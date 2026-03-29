#!/bin/bash

# 设备和配置
DEVICE="192.168.123.166:16384"
REMOTE_DIR="/data/local/tmp/myAutoJS"
PACKAGE_NAME="org.openautojs.autojs"
RUN_ACTIVITY="org.autojs.autojs.external.open.RunIntentActivity"

echo "--- 开始同步项目 ---"

# 1. 确保远程基础目录和lib目录存在
adb -s $DEVICE shell mkdir -p $REMOTE_DIR/lib

# 2. 推送 main.js
adb -s $DEVICE push /home/leon/iptv/myAutoJS/main.js $REMOTE_DIR/main.js

# 3. 推送 lib 目录下的所有内容 (显式处理 lib 文件夹)
adb -s $DEVICE push /home/leon/iptv/myAutoJS/lib/. $REMOTE_DIR/lib/

echo "--- 触发 OpenAutoJS 运行 ---"
adb -s $DEVICE shell am start -n $PACKAGE_NAME/$RUN_ACTIVITY -d file://$REMOTE_DIR/main.js

echo "--- 同步完成 ---"
