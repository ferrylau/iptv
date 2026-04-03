let jdUtils = require("./jd_utils.js");

let FIND_WIDGET_TIMEOUT = 6000

const CURRENT_NAME = "赚红包"

function enter() {
    let can_join = jdUtils.enterActivity(CURRENT_NAME);    
            
    return can_join
}

function doTask() {
    for (var i = 0; i < 2; i++) {
        let tempNode = text("次").findOne(FIND_WIDGET_TIMEOUT)
        if (!tempNode) {
            sleep(1000)
            Back()
            jdUtils.restartJD()
            enter()               
        }

        let taskpanel = tempNode.parent().parent().parent().child(0)
        taskpanel.click()
        sleep(3000)
        let browser = textContains("浏览").findOne(FIND_WIDGET_TIMEOUT)
        if (!browser) {
            jdUtils.restartJD()
            enter()            
            break
        }
        browser.click()        
        sleep(10000)
        Back()
        sleep(1000)
        Back()
        jdUtils.restartJD()
        enter()            
    }

    sleep(3000)
    for (var i = 0; i < 2; i++) {
        let tempNode = text("次").findOne(FIND_WIDGET_TIMEOUT)
        if (!tempNode) {
            sleep(1000)
            Back()
            jdUtils.restartJD()
            enter()               
        }

        let taskpanel = tempNode.parent().parent().parent().child(0)

        taskpanel.click()
        sleep(3000)
        let getNode = textContains("去领奖").findOne(FIND_WIDGET_TIMEOUT)
        if (!getNode) {
            jdUtils.restartJD()
            enter()            
            break
        }
        click(getNode.bounds().centerX(),getNode.bounds().centerY())
        sleep(1000)
        Back()
        jdUtils.restartJD()
        enter()            
    }

    sleep(3000)
    for (var i = 0; i < 1; i++) {
        let tempNode = text("次").findOne(FIND_WIDGET_TIMEOUT)
        if (!tempNode) {
            sleep(1000)
            Back()
            jdUtils.restartJD()
            enter()               
        }        
        let getPanel = tempNode.parent().parent().parent().child(1)

        getPanel.click()
        sleep(3000)
        Back()
        jdUtils.restartJD()
        enter()            
    }
}

function runTasks() {
    if (enter()) {
        toastLog("开始做赚红包任务...")
        doTask()
        toastLog("赚红包任务完成...")
        jdUtils.restartJD();
    }
}

module.exports = {
    runTasks: runTasks
};
