/*
 * 通用账号管理器 - 一个安全、极简的脚本配置工具
 * 
 * 使用方法:
 * 1. 在代理工具中配置一个 rewrite (重写) 规则, 将一个特定的域名指向此脚本。
 *    例如, 在 Quantumult X 中:
 *    hostname = config.local
 *    
 *    [rewrite_local]
 *    ^https?:\/\/config\.local url script-response-body account_manager.js
 * 
 * 2. 在代理工具中配置 MitM (中间人) 解密上述域名。
 *    例如, 在 Quantumult X 中:
 *    [mitm]
 *    hostname = %APPEND% config.local
 * 
 * 3. ！！！重要！！！ 修改下方配置中的 `SECRET_TOKEN` 为一个你自己专属的、足够复杂的密码。
 * 
 * 4. 在浏览器中访问 http://config.local?token=你设置的密码 来打开管理页面。
 */

// --- (必须) 用户配置 ---

// ！！！重要！！！请务必修改为一个长且随机的字符串作为你的安全密码。
const SECRET_TOKEN = "123456";

// 用于访问管理页面的域名, 请与你的 rewrite 规则保持一致。
const HOSTNAME = "config.local";

// --- 脚本核心配置 (一般无需修改) ---
const MASTER_KEY = "generic_account_manager_data"; // 所有数据存储在 $persistentStore 的这一个键下
const $ = new Env("通用账号管理器");


// --- 主逻辑 ---
(async () => {
    if ($request.hostname !== HOSTNAME) {
        $.msg("主机名不匹配", `脚本仅对 ${HOSTNAME} 生效`, `当前请求主机名: ${$request.hostname}`);
        $done();
        return;
    }

    const path = $request.path;
    const method = $request.method.toUpperCase();
    const params = new URLSearchParams($request.url.replace(/^http:/, 'https:').split('?')[1] || '');
    const bodyParams = new URLSearchParams(method === 'POST' ? $request.body || '' : '');

    const token = params.get('token') || bodyParams.get('token');

    if (SECRET_TOKEN === "change-me-to-a-secret-password") {
        return $.done({ response: { status: 400, body: generateErrorPage("安全警告: 请先在脚本文件中修改默认的 SECRET_TOKEN！") }});
    }

    if (token !== SECRET_TOKEN) {
        return $.done({ response: { status: 403, body: generateErrorPage("无效的 Token。请在URL中提供正确的访问令牌。例如: ?token=" + SECRET_TOKEN) }});
    }

    try {
        if (method === 'GET' && path === '/') {
            await handleGetAppList();
        } else if (method === 'GET' && path === '/accounts') {
            await handleGetAccountList(params.get('app_id'));
        } else if (method === 'POST' && path === '/save-app') {
            await handleSaveApp(bodyParams.get('app_id'), bodyParams.get('app_name'));
        } else if (method === 'POST' && path === '/delete-app') {
            await handleDeleteApp(bodyParams.get('app_id'));
        } else if (method === 'POST' && path === '/save-account') {
            await handleSaveAccount(bodyParams.get('app_id'), bodyParams.get('account_id'), bodyParams.get('account_name'), bodyParams.get('account_json'));
        } else if (method === 'POST' && path === '/delete-account') {
            await handleDeleteAccount(bodyParams.get('app_id'), bodyParams.get('account_id'));
        } else {
             $done({ response: { status: 404, body: generateErrorPage("404 Not Found") }});
        }
    } catch (e) {
        $.logErr(e);
        $done({ response: { status: 500, body: generateErrorPage(`脚本执行出错: ${e.message}`) }});
    }
})();

// --- 数据处理函数 ---
function getData() {
    const data = $.getjson(MASTER_KEY, { apps: {} });
    if (!data.apps) data.apps = {};
    return data;
}

function saveData(data) {
    return $.setjson(data, MASTER_KEY);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// --- 路由处理函数 ---

async function handleGetAppList() {
    const data = getData();
    const body = generateAppListPage(data.apps);
    $done({ response: { status: 200, body }});
}

async function handleGetAccountList(appId) {
    if (!appId) return $done({ response: { status: 400, body: generateErrorPage("缺少 app_id 参数") }});
    const data = getData();
    const app = data.apps[appId];
    if (!app) return $done({ response: { status: 404, body: generateErrorPage("找不到指定的应用") }});
    const body = generateAccountListPage(app, appId);
    $done({ response: { status: 200, body }});
}

async function handleSaveApp(appId, appName) {
    if (!appName) return $done({ response: { status: 400, body: generateErrorPage("应用名称不能为空") }});
    const data = getData();
    const id = appId || generateId();
    data.apps[id] = { ...data.apps[id], name: appName };
    saveData(data);
    redirect('/');
}

async function handleDeleteApp(appId) {
    if (!appId) return $done({ response: { status: 400, body: generateErrorPage("缺少 app_id 参数") }});
    const data = getData();
    delete data.apps[appId];
    saveData(data);
    redirect('/');
}

async function handleSaveAccount(appId, accountId, accountName, accountJson) {
    if (!appId || !accountName || !accountJson) {
        return $done({ response: { status: 400, body: generateErrorPage("应用ID、账号名称和JSON内容均不能为空") }});
    }

    let accountData;
    try {
        accountData = JSON.parse(accountJson);
    } catch (e) {
        return $done({ response: { status: 400, body: generateErrorPage(`JSON格式错误: ${e.message}`) }});
    }

    const data = getData();
    if (!data.apps[appId]) return $done({ response: { status: 404, body: generateErrorPage("找不到指定的应用") }});
    
    if (!data.apps[appId].accounts) data.apps[appId].accounts = [];

    const accounts = data.apps[appId].accounts;
    const existingIndex = accountId ? accounts.findIndex(acc => acc.id === accountId) : -1;

    if (existingIndex > -1) { // 编辑
        accounts[existingIndex] = { ...accounts[existingIndex], name: accountName, data: accountData };
    } else { // 新增
        accounts.push({ id: generateId(), name: accountName, data: accountData });
    }

    saveData(data);
    redirect(`/accounts?app_id=${appId}`);
}

async function handleDeleteAccount(appId, accountId) {
    if (!appId || !accountId) return $done({ response: { status: 400, body: generateErrorPage("缺少 app_id 或 account_id 参数") }});
    
    const data = getData();
    if (!data.apps[appId] || !data.apps[appId].accounts) {
        return $done({ response: { status: 404, body: generateErrorPage("找不到指定的应用或账号列表") }});
    }

    data.apps[appId].accounts = data.apps[appId].accounts.filter(acc => acc.id !== accountId);
    saveData(data);
    redirect(`/accounts?app_id=${appId}`);
}

function redirect(path) {
    const url = `${path}${path.includes('?') ? '&' : '?'}token=${SECRET_TOKEN}`;
    $done({ response: { status: 302, headers: { Location: url } }});
}

// --- HTML 生成函数 ---
function getBaseHtml(title, content) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; background-color: #f4f4f8; color: #333; }
        .container { max-width: 800px; margin: 20px auto; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        h1, h2 { color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        a { color: #007aff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .list-item { display: flex; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid #eee; }
        .list-item:last-child { border-bottom: none; }
        .list-item .name { font-size: 1.1em; font-weight: 500; }
        .actions a, .actions button { margin-left: 10px; font-size: 0.9em; }
        .form-section { background-color: #fafafa; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #eee; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
        .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .form-group textarea { min-height: 120px; font-family: monospace; }
        .btn { background-color: #007aff; color: #fff; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; }
        .btn:hover { background-color: #0056b3; }
        .btn-danger { background-color: #ff3b30; }
        .btn-danger:hover { background-color: #c00; }
        .hidden { display: none; }
        .breadcrumb { margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        ${content}
    </div>
</body>
</html>`;
}

function generateAppListPage(apps) {
    const appListHtml = Object.keys(apps).length > 0 
        ? Object.entries(apps).map(([id, app]) => `
            <div class="list-item">
                <a href="/accounts?token=${SECRET_TOKEN}&app_id=${id}" class="name">${escapeHtml(app.name)}</a>
                <div class="actions">
                    <form action="/delete-app" method="POST" onsubmit="return confirm('确定要删除整个应用及其所有账号吗？');" style="display:inline;">
                        <input type="hidden" name="token" value="${SECRET_TOKEN}">
                        <input type="hidden" name="app_id" value="${id}">
                        <button type="submit" class="btn-danger">删除</button>
                    </form>
                </div>
            </div>`).join('')
        : '<p>暂无应用。请在下方添加一个新应用。</p>';

    const content = `
        <h2>应用列表</h2>
        <div>${appListHtml}</div>
        <div class="form-section">
            <h2>添加新应用</h2>
            <form action="/save-app" method="POST">
                <input type="hidden" name="token" value="${SECRET_TOKEN}">
                <div class="form-group">
                    <label for="app_name">应用名称</label>
                    <input type="text" id="app_name" name="app_name" placeholder="例如: 叮咚农场" required>
                </div>
                <button type="submit" class="btn">保存应用</button>
            </form>
        </div>`;
    return getBaseHtml('通用账号管理器', content);
}

function generateAccountListPage(app, appId) {
    const accounts = app.accounts || [];
    const accountListHtml = accounts.length > 0 
        ? accounts.map(acc => `
            <div class="list-item" id="acc-${acc.id}">
                <div class="name">${escapeHtml(acc.name)}</div>
                <div class="actions">
                    <a href="#form-edit" onclick="editAccount('${appId}', '${acc.id}', '${escapeJs(acc.name)}', '${escapeJs(JSON.stringify(acc.data, null, 2))}')">编辑</a>
                    <form action="/delete-account" method="POST" onsubmit="return confirm('确定要删除这个账号吗？');" style="display:inline;">
                        <input type="hidden" name="token" value="${SECRET_TOKEN}">
                        <input type="hidden" name="app_id" value="${appId}">
                        <input type="hidden" name="account_id" value="${acc.id}">
                        <button type="submit" class="btn-danger">删除</button>
                    </form>
                </div>
            </div>`).join('')
        : '<p>此应用下暂无账号。</p>';

    const content = `
        <div class="breadcrumb"><a href="/?token=${SECRET_TOKEN}">返回应用列表</a></div>
        <h2>${escapeHtml(app.name)} - 账号列表</h2>
        <div>${accountListHtml}</div>

        <div class="form-section" id="form-edit">
            <h2 id="form-title">添加新账号</h2>
            <form action="/save-account" method="POST">
                <input type="hidden" name="token" value="${SECRET_TOKEN}">
                <input type="hidden" name="app_id" value="${appId}">
                <input type="hidden" id="account_id" name="account_id" value="">
                <div class="form-group">
                    <label for="account_name">账号名称</label>
                    <input type="text" id="account_name" name="account_name" placeholder="例如: 我的主账号" required>
                </div>
                <div class="form-group">
                    <label for="account_json">账号数据 (JSON格式)</label>
                    <textarea id="account_json" name="account_json" placeholder='{
  "cookie": "your_cookie_here",
  "userAgent": "your_ua_here"
}' required></textarea>
                </div>
                <button type="submit" class="btn">保存账号</button>
                <a href="#" onclick="resetForm(); return false;" style="margin-left: 10px;">取消编辑</a>
            </form>
        </div>
        <script>
            function editAccount(appId, accountId, accountName, accountJson) {
                document.getElementById('form-title').innerText = '编辑账号';
                document.getElementById('account_id').value = accountId;
                document.getElementById('account_name').value = accountName;
                document.getElementById('account_json').value = accountJson;
                window.location.hash = 'form-edit';
            }
            function resetForm() {
                document.getElementById('form-title').innerText = '添加新账号';
                document.getElementById('account_id').value = '';
                document.getElementById('account_name').value = '';
                document.getElementById('account_json').value = '';
                window.location.hash = '';
            }
        </script>
        `;
    return getBaseHtml(`管理: ${escapeHtml(app.name)}`, content);
}

function generateErrorPage(message) {
    const content = `<h2>发生错误</h2><p style="color: #ff3b30;">${escapeHtml(message)}</p>`;
    return getBaseHtml("错误", content);
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
function escapeJs(unsafe) {
    return unsafe
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}


// --- Env.js Lite ---
function Env(t){this.name=t,this.log=function(...t){console.log(t.join(" "))},this.getjson=(t,e)=>{let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s},this.setjson=(t,e)=>this.setdata(JSON.stringify(t),e),this.getdata=t=>$persistentStore.read(t),this.setdata=(t,e)=>$persistentStore.write(t,e),this.msg=(t,e,s="")=>$notification.post(t,e,s),this.logErr=(t,e)=>this.log(`❗️ ${this.name}, 错误!`,t,e)}