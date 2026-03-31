let jdUtils = require("./jd_utils.js");

let FIND_WIDGET_TIMEOUT = 6000

const CURRENT_NAME = "京东秒杀"

function enterMisosha() {
    let can_join = jdUtils.enterActivity(CURRENT_NAME);        
    return can_join
}

function sign() {
    let signNodetext = text("签到领豆").findOne(FIND_WIDGET_TIMEOUT)
    
    if (signNodetext) {
        let parentSign = signNodetext.parent()
        if (parentSign && parentSign.clickable()) {                
            parentSign.click()
        }            
    }
}

function doTask() {
    for (var i = 0; i < 39; i++) {
        let panelNode = idContains("homeSignButton").findOne(FIND_WIDGET_TIMEOUT)
        if (panelNode) {        
            panelNode.click()
            sleep(3000)
        }    

        click(380, 851);
        sleep(7000)
        Back()
        sleep(1000)
        Back()
        sleep(1000)
        Back()
        sleep(1000)
        jdUtils.restartJD()
        enterMisosha()
    }
}

function runTasks() {
    if(enterMisosha()) {
        log("开始签到秒杀...")        
        sign()
        log("签到完成，准备重启......")   
        jdUtils.restartJD()      
    }

    if (enterMisosha()) {
        log("开始做秒杀任务...")
        doTask()
        log("秒杀任务完成...")
        jdUtils.restartJD();
    }
}

module.exports = {
    runTasks: runTasks
};
