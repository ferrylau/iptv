let jdUtils = require("./jd_utils.js");

let FIND_WIDGET_TIMEOUT = 6000
const targetTexts = ["至高领", "逛逛爆品", "发现惊喜", "好物清单", "服饰美妆"
                    ,"逛家电家居","逛新品", "京东直播","健康天天低价","看视频赚现金", 
                    ,"买手机享国补优惠", "逛母婴","免费领","直播","黄金","星推官"]
const finishTag = ["状态：已领取", "状态：已完成"]    
const receiveTag = ["去领取"]    

const CURRENT_NAME = "东东农场"

function enterFarm() {
    let can_join = jdUtils.enterActivity(CURRENT_NAME);    

    sleep(5000)
    //活动太火爆了， 请稍后再试~
    let huobao = text("活动太火爆了， 请稍后再试~").findOne(FIND_WIDGET_TIMEOUT);
    let tiaoguo = text("跳过").findOne(FIND_WIDGET_TIMEOUT);
    let gonggao = text("公告").findOne(FIND_WIDGET_TIMEOUT);
    if (huobao || tiaoguo || gonggao) {        
        jdUtils.restartJD()
        return enterFarm()
    }
    return can_join
}

function sign() {
    var signNode
    // 签到
    for (var i = 0;i<20;i++) {
        signNode = text("点击前往签到页面").findOne(FIND_WIDGET_TIMEOUT);
        if (!signNode) {
            sleep(1000)            
            jdUtils.restartJD();
            enterFarm();
            sleep(2000);            
        }
        else {
            break
        }
    }

    var jdbeans = textContains("京豆").findOne(FIND_WIDGET_TIMEOUT);
    if (jdbeans) {
        jdbeans.click()
        sleep(5000)

        var getbeans = textContains("https://img11.360buyimg.com").findOne(FIND_WIDGET_TIMEOUT);
        if (getbeans) {
            getbeans.click()
            sleep(5000)
        }
        jdUtils.restartJD();
        enterFarm();
        sleep(2000);           
    }

    for (var i = 0;i<20;i++) {
        signNode = text("点击前往签到页面").findOne(FIND_WIDGET_TIMEOUT);
        if (!signNode) {
            sleep(1000)            
            jdUtils.restartJD();
            enterFarm();
            sleep(2000);            
        }
        else {
            break
        }
    }    

    if (signNode && signNode.clickable()) {
        if (signNode.click()) {
            sleep(3000);
            let signBtn = text("点击签到领水滴").findOne(FIND_WIDGET_TIMEOUT);
            if (signBtn && signBtn.clickable()) {
                if (signBtn.click()) {
                    sleep(2000)
                    toastLog("签到领水滴成功")
                }
            }                                
        }                        
    }            
}

function getTaskAward() {
    let taskNode = text("点击前往做任务领水滴页面").findOne(FIND_WIDGET_TIMEOUT);
    var firstnode
    if (taskNode) {
        taskNode.click()
        sleep(2000)        
        parentPanel = text("图标 去小程序邀请好友助力 已完成0次，总共15次 邀请1人奖励 图标 加150g水滴 点击去分享任务").findOne(FIND_WIDGET_TIMEOUT).parent()      
        for (var z = 0; z < parentPanel.childCount(); z++) {
            sleep(1000);
            var child2 = parentPanel.child(z);                                                 
            
            if (jdUtils.isPartialMatch(child2.text(), receiveTag)) {
                child2.click();
                sleep(5000);
            }

            if (z > 0) {
                swipe(child2.bounds().centerX(), child2.bounds().centerY(),
                firstnode.bounds().centerX(),firstnode.bounds().centerX(),1000);         
                sleep(500)
            }
            firstnode = child2
        }      
    } 
}


function runFarmTasks() {
    // 水滴签到
    if (enterFarm()) {
        toastLog("开始签到......")   
        sign() // 签到
        toastLog("签到完成，准备重启......")   
        jdUtils.restartJD()                            
    }

    // 做领水滴任务        
    if (enterFarm()) {         
        toastLog("开始做任务......")   
        var state = "打开水滴任务";

        var i = -1
        var j = 0
        var parentPanel                                    
        while (true) {
            if (state === "打开水滴任务") {
                let taskNode = text("点击前往做任务领水滴页面").findOne(FIND_WIDGET_TIMEOUT);
                if (taskNode) {
                    taskNode.click()
                    sleep(2000)        
                    parentPanel = text("图标 去小程序邀请好友助力 已完成0次，总共15次 邀请1人奖励 图标 加150g水滴 点击去分享任务").findOne(FIND_WIDGET_TIMEOUT).parent()      
                    i = -1
                    j = 0            
                    state = "执行任务";
                } else {
                    state = "退出"
                }
            } else if (state === "执行任务") {                               
                ++i;       
                if (parentPanel.childCount() > 0 && i < parentPanel.childCount()) {
                    // 滑动到指定位置
                    var firstnode
                    for (; j < i; j++) {                            
                        var targetChild = parentPanel.child(j);                           
                        
                        if (firstnode) {
                            swipe(targetChild.bounds().centerX(), targetChild.bounds().centerY(),
                            firstnode.bounds().centerX(),firstnode.bounds().centerX(),1000);         
                            sleep(500)
                        }
                        firstnode = targetChild
                    }                            

                    var child = parentPanel.child(i);
                    // toastLog("第" + i + " 个子节点信息 ---");
                    // toastLog("Text: " + child.text());     

                    if (jdUtils.isPartialMatch(child.text(), targetTexts)
                        && !jdUtils.isPartialMatch(child.text(), finishTag)
                        && !jdUtils.isPartialMatch(child.text(), receiveTag)) {
                        child.click();
                        sleep(10000);
                        Back();
                        sleep(1000)
                        Back();
                        sleep(1000)
                        Back();
                        sleep(2000);
                        jdUtils.restartJD();
                        enterFarm();
                        sleep(2000);
                        state = "打开水滴任务";
                    }                                                            
                }          
                else {
                    jdUtils.restartJD();
                    enterFarm();
                    sleep(2000);                        
                    state = "领取"; 
                }                                                      
            } else if (state == "领取") {
                getTaskAward()                                       
                state = "退出";
            }
            else if (state === "退出") {
                sleep(2000);
                toastLog("任务完成，准备重启......")   
                jdUtils.restartJD();
                break;
            }
        }             
    }

    // 去浇水
    if (enterFarm()) {
        toastLog("开始浇水......")
        while (true) {                
            let bottle = textContains("点击水壶浇水").findOne(FIND_WIDGET_TIMEOUT)
            
            if (bottle) {                    
                bottle.click()                    

                let notEnough = textContains("水滴不足哦~").findOne(FIND_WIDGET_TIMEOUT)
                if (notEnough) {
                    getTaskAward() // 再领取一次奖励试试
                    break
                }             
                else {
                    sleep(1000)
                    jdUtils.restartJD()
                    enterFarm()
                }
                sleep(2000)       
            }
            else {
                break;
            }                
        }    
        toastLog("浇水完成......")  
    }
    jdUtils.restartJD();
}

module.exports = {
    runFarmTasks: runFarmTasks
};
