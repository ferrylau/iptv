let jdUtils = require("./jd_utils.js");

let FIND_WIDGET_TIMEOUT = 6000

const CURRENT_NAME = "赚话费"

function enter() {
    let can_join = jdUtils.enterActivity(CURRENT_NAME);        
    return can_join
}

function sign() {
    for (var i = 0;i<3; i++) {
        let signNodetext = text("立即签到").findOne(FIND_WIDGET_TIMEOUT)
        
        if (signNodetext) {
            if (signNodetext.clickable()) {
                signNodetext.click()
                break
            }
            else {
                let parentSign = signNodetext.parent()
                if (parentSign && parentSign.clickable()) {                
                    parentSign.click()
                    break
                }   
            }         
        }
    }
    sleep(3500)
}

function doTask() {
    for (var i = 0; i < 5; i++) {
        var panelNode = text("立即前往").findOne(FIND_WIDGET_TIMEOUT)
        if (!panelNode) {
            panelNode = text("立即领取").findOne(FIND_WIDGET_TIMEOUT)
        }
        if (panelNode) {        
            panelNode.click()
            sleep(3000)
        }    

        // click(380, 851);
        sleep(7000)
        Back()
        sleep(1000)
        Back()
        sleep(1000)
        jdUtils.restartJD()
        enter()
    }
}

function runTasks() {
    if(enter()) {
        toastLog("开始签到赚话费...")        
        sign()
        toastLog("赚话费签到完成，准备重启......")   
        jdUtils.restartJD()      
    }

    if (enter()) {
        toastLog("开始做赚话费任务...")
        doTask()
        toastLog("赚话费任务完成...")
        jdUtils.restartJD();
    }
}

module.exports = {
    runTasks: runTasks
};
