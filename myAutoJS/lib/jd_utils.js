function isIconOnFirstPage(tx) {
    let myNode = text(tx).findOnce(); // 使用 findOnce 不阻塞
    if (myNode) {
        // 判断控件的中心点是否在屏幕宽度范围内
        let bounds = myNode.bounds();
        let screenWidth = device.width;
        
        // 如果中心坐标在屏幕内，说明在当前页
        if (bounds.centerX() > 0 && bounds.centerX() < screenWidth) {
            return true;
        }
    }
    return false; // 找不到或者在屏幕外
}

function findtextAndClick(tx, sleeptime) { 
    let myNode = text(tx).findOne()
    if (myNode) {
        let xp = myNode.bounds().centerX()
        let yp = myNode.bounds().centerY()        
        if (xp < 0 || yp < 0) {
            return false
        }
        let flag = click(xp, yp)
        sleep(sleeptime)    
        // toastLog("click=" + tx + " flag=" + flag)    
        return flag
    }
    return false
}

function startJD() {
    var loaded = false
    app.launchPackage("com.jingdong.app.mall")
    for (var i = 0; i < 20; i++) {
        // currentPackage() 是极其底层的系统调用，不扫描 UI 树，避开 Android 9 系统兼容问题
        if (currentPackage() === "com.jingdong.app.mall") {
            text("我的").waitFor();
            findtextAndClick("我的", 3000)
            text("浏览记录").waitFor();
            findtextAndClick("浏览记录", 3000)
            text("频道").waitFor();
            findtextAndClick("频道", 3000)
            text("我看过的频道").waitFor();            
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
    sleep(3000);
    startJD();
    sleep(3000);
}

function isPartialMatch(text, keywords) {
    if (!text || !keywords || keywords.length === 0) {
        return false;
    }
    return keywords.some(keyword => text.trim().includes(keyword.trim()));
}

function enterActivity(tx) {
    var can_join = false;
    for (var i = 0; i < 5; i++) {
        toastLog("第 " + (i + 1) + " 次尝试寻找: " + tx);
        
        // 1. 增加模糊匹配和描述匹配
        let myNode = text(tx).findOnce() || desc(tx).findOnce() || textContains(tx).findOnce();
        
        if (myNode) {
            let b = myNode.bounds();
            // 只要控件有一部分在屏幕内 (比如左边界小于屏幕宽，右边界大于0)
            if (b.right > 0 && b.left < device.width && b.centerY() > 0 && b.centerY() < device.height) {
                toastLog("确定找到图标，准备点击...");
                // 注意：这里建议直接用 myNode.click()，如果不行再用坐标
                can_join = findtextAndClick(tx, 3000);
                break;
            }
        }
        
        toastLog("当前页未找到，执行滑动...");
        // 稍微加长滑动时长 (500ms)，让滑动更平稳
        swipe(device.width * 0.8, 550, device.width * 0.2, 550, 500);
        // 滑动后留出充足时间让 UI 渲染
        sleep(2000); 
    }
    return can_join;
}

module.exports = {
    startJD: startJD,
    exitJD: exitJD,
    restartJD: restartJD,
    isPartialMatch: isPartialMatch,
    findtextAndClick: findtextAndClick,
    isIconOnFirstPage: isIconOnFirstPage,
    enterActivity: enterActivity,
};
