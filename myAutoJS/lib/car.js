let jdUtils = require("./jd_utils.js");

let FIND_WIDGET_TIMEOUT = 6000

const CURRENT_NAME = "买车养车"

function enter() {
    let can_join = jdUtils.enterActivity(CURRENT_NAME);    
    
    if (can_join) {
        sleep(3000)
        click(653,1223)
        sleep(3000)
    }
            
    return can_join
}

function doTask() {
    for (var i = 0; i < 10; i++) {
        let signNodetext = textContains("签到").findOne(FIND_WIDGET_TIMEOUT)
        if (!signNodetext) {
            break
        }
        signNodetext.click()
        sleep(3000)
        let taskPanel = text("今日任务").findOne(FIND_WIDGET_TIMEOUT).parent().child(1)
        if (!taskPanel) {
            break
        }
        taskPanel.click()
        sleep(3000)

        let visit = text("去浏览").findOne(FIND_WIDGET_TIMEOUT)
        if (visit) {
            visit.click()
            sleep(10000)
            Back()
            sleep(1000)
            Back()
            jdUtils.restartJD()
            enter()            
        }

        let signnode = text("签到").findOne(FIND_WIDGET_TIMEOUT)
        if (signnode) {
            signnode.click()
            sleep(3000)
            jdUtils.restartJD()
            enter()
        }        
    }
}

function runTasks() {
    if (enter()) {
        toastLog("开始做车主福利任务...")
        doTask()
        toastLog("车主福利任务完成...")
        jdUtils.restartJD();
    }
}

module.exports = {
    runTasks: runTasks
};
