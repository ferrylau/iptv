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

module.exports = {
    startJD: startJD,
    exitJD: exitJD,
    restartJD: restartJD
};
