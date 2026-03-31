let jdUtils = require("./lib/jd_utils.js");
let farm = require("./lib/farm.js");
let miaosha = require("./lib/miaosha.js");
let Beans = require("./lib/beans.js");

auto.waitFor();
console.show();

// 强制停止京东，确保脚本运行时环境干净
jdUtils.exitJD();

log("启动京东...");



if (jdUtils.startJD()) {
    log("京东已在前台，等待界面渲染...!");
    // 给 3 秒让首页渲染完全
    sleep(3000);     

    // let farmNode = text("秒杀").findOne();
    // if (farmNode) {
        
    //     let b = swipe(farmNode.bounds().centerX()+430, farmNode.bounds().centerY(), 0, farmNode.bounds().centerY(), 200)
    //     let allchannel = text("全部频道").findOne(6000);
    //     if (allchannel) {
    //         click(allchannel.bounds().centerX(), allchannel.bounds().centerY())

    //         sleep(2000)
    //         let hdGame = textContains("京东点评").findOne();
    //         if (hdGame) {
    //             click(hdGame.bounds().centerX(), hdGame.bounds().centerY())
    //             log("click hd game")
    //         }
    //         else {
    //             log("not found hd game")
    //         }
    //     }        
    // }
    // sleep(10000)

    // 开始东东农场任务
    farm.runFarmTasks();
    // 秒杀任务
    // miaosha.runTasks();
    // 种豆得豆
    // Beans.runTasks();
    // 退出
    jdUtils.exitJD();
  
} else {
    log("检测启动超时，未进入京东 App");
}

sleep(2000);
console.hide();
