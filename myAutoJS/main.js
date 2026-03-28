let FIND_WIDGET_TIMEOUT = 6000
const targetTexts = ["至高领", "逛逛爆品", "发现惊喜", "好物清单", "服饰美妆"
                    ,"逛家电家居","逛新品", "京东直播","健康天天低价","看视频赚现金", 
                    ,"买手机享国补优惠", "逛母婴","免费领"]
const finishTag = ["状态：已领取", "状态：已完成"]    
const receiveTag = ["去领取"]    

function isPartialMatch(text, keywords) {
    if (!text || !keywords || keywords.length === 0) {
        return false;
    }
    return keywords.some(keyword => text.trim().includes(keyword.trim()));
}

function startJD() {
    var loaded = false
    app.launchPackage("com.jingdong.app.mall")
    for (var i = 0; i < 20; i++) {
        // currentPackage() 是极其底层的系统调用，不扫描 UI 树，避开 Android 9 系统兼容问题
        if (currentPackage() === "com.jingdong.app.mall") {
            loaded = true;
            break;
        }
        sleep(2000);
    }
    sleep(3000)
    return loaded
}

function exitJD() {
    shell("am force-stop com.jingdong.app.mall", true);
    sleep(1000);
}

function restartJD() {
    exitJD();
    sleep(2000);
    startJD();
    sleep(2000);
}

function enterFarm() {
    var can_join = false;
    let farmNode = text("东东农场").findOne(FIND_WIDGET_TIMEOUT);
    // 进入东东农场
    if (farmNode) {
        if (farmNode.clickable()){
            can_join = farmNode.click();
        } else {
            let parentNode = farmNode.parent();
            if (parentNode.clickable()) {
                can_join = parentNode.click();
            }
        }        
    }    

    sleep(3000)
    //活动太火爆了， 请稍后再试~
    let huobao = text("活动太火爆了， 请稍后再试~").findOne(FIND_WIDGET_TIMEOUT);
    let tiaoguo = text("跳过").findOne(FIND_WIDGET_TIMEOUT);
    let gonggao = text("公告").findOne(FIND_WIDGET_TIMEOUT);
    if (huobao || tiaoguo || gonggao) {        
        restartJD()
        return enterFarm()
    }

    // let gonggao = text("公告").findOne(FIND_WIDGET_TIMEOUT);
    // if (gonggao) {
    //     let closegonggao = text("关闭公告弹窗").findOne(FIND_WIDGET_TIMEOUT);
    //     let closegonggao1 = text("我知道了，关闭公告弹窗").findOne(FIND_WIDGET_TIMEOUT);
    //     if (closegonggao) {
    //         closegonggao.click()
    //     }
    //     else if (closegonggao1) {
    //         closegonggao1.click()
    //     }
    // }

    // let tiaoguo = text("跳过").findOne(FIND_WIDGET_TIMEOUT);
    // if (tiaoguo) {
    //     tiaoguo.click()
    // }    
    return can_join
}

function sign() {
    let signNode = text("点击前往签到页面").findOne(FIND_WIDGET_TIMEOUT);
    // 签到
    if (signNode && signNode.clickable()) {
        if (signNode.click()) {
            sleep(3000);
            let backbtn = id("com.jingdong.app.mall:id/fe").findOne(FIND_WIDGET_TIMEOUT)
            // 判断是否已经签到
            let judgeText = text("已签到").findOne(FIND_WIDGET_TIMEOUT)
            if (!judgeText) {
                // 点击签到
                let signBtn = text("点击签到领水滴").findOne(FIND_WIDGET_TIMEOUT);
                if (signBtn && signBtn.clickable()) {
                    if (signBtn.click()) {
                        log("签到领水滴成功")
                    }
                }                    
            }
            backbtn.click()
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
            
            if (isPartialMatch(child2.text(), receiveTag)) {
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

auto.waitFor();
console.show();

// 强制停止京东，确保脚本运行时环境干净
exitJD();

log("启动京东...");

if (startJD()) {
    log("京东已在前台，等待界面渲染...!");
    // 给 3 秒让首页渲染完全，不需要死等 10 秒
    sleep(3000); 

    do {        
        // 水滴签到
        if (enterFarm()) {
            log("开始签到......")   
            sign() // 签到
            log("签到完成，准备重启......")   
            restartJD()                            
        }

        // 做领水滴任务        
        if (enterFarm()) {         
            log("开始做任务......")   
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
                        j = 0            
                        state = "执行任务";
                    } else {
                        state = "退出"
                    }
                } else if (state === "执行任务") {                               
                    ++i;       
                    if (parentPanel.childCount() > 0 && i != parentPanel.childCount()) {
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
                        // log("第" + i + " 个子节点信息 ---");
                        // log("Text: " + child.text());     

                        if (isPartialMatch(child.text(), targetTexts)
                            && !isPartialMatch(child.text(), finishTag)
                            && !isPartialMatch(child.text(), receiveTag)) {
                            child.click();
                            sleep(10000);
                            Back();
                            Back();
                            Back();
                            sleep(2000);
                            restartJD();
                            enterFarm();
                            sleep(2000);
                            state = "打开水滴任务";
                        }                                                            
                    }          
                    else {
                        restartJD();
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
                    log("任务完成，准备重启......")   
                    restartJD();
                    break;
                }
            }             
        }

        // 去浇水
        if (enterFarm()) {
            log("开始浇水......")
            while (true) {                
                let bottle = textContains("点击水壶浇水").findOne(FIND_WIDGET_TIMEOUT)
                
                if (bottle) {                    
                    bottle.click()                    

                    let notEnough = textContains("水滴不足哦~").findOne(FIND_WIDGET_TIMEOUT)
                    if (notEnough) {
                        getTaskAward() // 再领取一次奖励试试
                        break
                    }             
                    sleep(7000)       
                }
                else {
                    break;
                }                
            }    
            log("浇水完成......")  
        }

        // 退出
        exitJD();
  
    } while (false)

} else {
    log("检测启动超时，未进入京东 App");
}

sleep(2000);
console.hide();
