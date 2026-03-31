let jdUtils = require("./lib/jd_utils.js");
let farm = require("./lib/farm.js");
let miaosha = require("./lib/miaosha.js");
let Beans = require("./lib/beans.js");
let huafei = require("./lib/huafei.js");

auto.waitFor();
// console.show();

// 强制停止京东，确保脚本运行时环境干净
jdUtils.exitJD();

toastLog("启动京东...");

if (jdUtils.startJD()) {
    toastLog("京东已在前台，等待界面渲染...!");
    // 给 3 秒让首页渲染完全
    sleep(3000);

    // 开始东东农场任务
    // farm.runFarmTasks();
    // 秒杀任务
    // miaosha.runTasks();
    // 种豆得豆
    // Beans.runTasks();
    // 退出
    huafei.runTasks();
    jdUtils.exitJD();
  
} else {
    toastLog("检测启动超时，未进入京东 App");
}

sleep(2000);
console.hide();
