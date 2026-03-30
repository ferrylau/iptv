let jdUtils = require("./jd_utils.js");

let FIND_WIDGET_TIMEOUT = 6000
function enterBeans() {
    var can_join = false;
    let beansNode = text("种豆得豆").findOne(FIND_WIDGET_TIMEOUT);
    // 进入
    if (beansNode) {
        if (beansNode.clickable()){
            can_join = beansNode.click();
        } else {
            let parentNode = beansNode.parent();
            if (parentNode.clickable()) {
                can_join = parentNode.click();
            }
        }        
    }    
    sleep(5000)
    return can_join
}

function sign() {
    let signNodetext = text("点击领奖").findOne(FIND_WIDGET_TIMEOUT)
    
    if (signNodetext) {        
        let parentSign = signNodetext.parent()
        if (parentSign && parentSign.clickable()) {                
            parentSign.click()            
        }            
    }
}

function getBeans() {
    while (true) {
        let node1 = textMatches(/\\+[1-9]\\d*/).findOne(FIND_WIDGET_TIMEOUT);
        if (node1) {                   
            let parentSign = node1.parent()
            if (parentSign && parentSign.clickable()) {                                
                parentSign.click()    
                sleep(3000)
                jdUtils.restartJD()
                enterBeans()    
                sleep(3000)            
            }
            else {
                break
            }
        }        
        else {
            break
        }
        sleep(5000)
    }
}

function openTaskPanel() {


    while (true) {
        var ok = false
        let node = text("好友助力").findOne(FIND_WIDGET_TIMEOUT)
        if (node) {        
            let node1 = node.parent()
            if (node1) {
                let node2 = node1.parent()
                if (node2) {
                    let node3 = node2.parent()
                    if (node3) {
                        let node4 = node3.child(8)
                        node4.click()
                        ok = true
                    }
                }
            }            
        }

        if (ok) {
            sleep(1000)
            break
        }
        else {
            jdUtils.restartJD()
            enterBeans()    
            sleep(3000)        
        }
    }
}

function doTask() {
    openTaskPanel()
    sleep(3000)
    let signtask = text("去签到").findOne(FIND_WIDGET_TIMEOUT)
    if (signtask) {
        click(signtask.bounds().centerX(),signtask.bounds().centerY())
        sleep(3000)
    }
    
    jdUtils.restartJD()
    enterBeans()
    sleep(3000)

    for (var i = 0; i < 1; i++) {
        openTaskPanel()
        sleep(3000)        

        click(313, 701);
        sleep(31000)
        Back()
        sleep(1000)
        Back()
        sleep(1000)
        Back()
        sleep(1000)
        jdUtils.restartJD()
        enterBeans()
    }
}

function runTasks() {
    if(enterBeans()) {
        log("开始签到种豆得豆...")        
        sign()
        sleep(10000)
        log("签到完成，准备重启......")   
        jdUtils.restartJD()      
    }

    if (enterBeans()) {
        log("开始做种豆得豆任务...")
        doTask()
        sleep(10000)
        log("种豆得豆任务完成...")
        jdUtils.restartJD();
    }

    if(enterBeans()) {
        log("开始收取收获值,种豆得豆...")        
        getBeans()
        sleep(10000)
        log("收获值完成，准备重启......")   
        jdUtils.restartJD()      
    }    
}

module.exports = {
    runTasks: runTasks
};
