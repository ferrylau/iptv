let jdUtils = require("./jd_utils.js");

let FIND_WIDGET_TIMEOUT = 6000
function enterMisosha() {
    var can_join = false;
    let msNode = text("秒杀").findOne(FIND_WIDGET_TIMEOUT);
    // 进入秒杀
    if (msNode) {
        if (msNode.clickable()){
            can_join = msNode.click();
        } else {
            let parentNode = msNode.parent();
            if (parentNode.clickable()) {
                can_join = parentNode.click();
            }
        }        
    }    
    sleep(5000)
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

function findscroll() {
    let tempText = textContains("盲盒等级").findOne(FIND_WIDGET_TIMEOUT)
    if (tempText) {
        var tempPanel = tempText.parent();
        if (tempPanel) {
            var linearPanel = tempPanel.parent();
            // 应该只有两个
            if (linearPanel.childCount() == 2) {
                var scrollview = linearPanel.child(1)
                if (scrollview) {
                    return scrollview                    
                }
            }
        }
    }
}

function doTask() {
    for (var i = 0; i < 30; i++) {
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
