import flask
import requests
import gzip
import json
from flask import request, Response

# =================================================================================
# 1. --- 初始化 Flask App ---
# =================================================================================
app = flask.Flask(__name__)

# =================================================================================
# 2. --- 核心修改与伪造逻辑 ---
# =================================================================================

def create_fake_energy_response(request_body_str):
    """为能量请求伪造一个成功的批量响应"""
    print("[PROXY] Intercepting energy request. Faking success.")
    try:
        req_obj = json.loads(request_body_str)
        num_requests = len(req_obj.get("requests", []))
        
        fake_sub_response = {
            "status": 200,
            "body": "{}",
            "headers": {"Content-Type": "application/json"}
        }
        
        fake_responses = [fake_sub_response] * num_requests
        fake_response_body = json.dumps({"responses": fake_responses})
        
        return Response(fake_response_body, 200, {'Content-Type': 'application/json;charset=UTF-8'})
    except Exception as e:
        print(f"[PROXY] ❌ Error creating fake energy response: {e}")
        return Response("Error faking energy response", 500)


def apply_plus_unlock_modifications(response_obj):
    """修改批量请求的响应，以解锁 Plus 功能"""
    try:
        if "responses" in response_obj and isinstance(response_obj["responses"], list):
            for i, res in enumerate(response_obj["responses"]):
                body_str = res.get("body", "")
                if "subscriberLevel" in body_str or "energyConfig" in body_str:
                    print(f"[PROXY] Modifying sub-response {i} to unlock Plus features.")
                    try:
                        inner_body = json.loads(body_str)
                        
                        # 应用解锁
                        inner_body['subscriberLevel'] = "MAX"
                        inner_body['hasPlus'] = True
                        if 'energyConfig' in inner_body:
                            inner_body['energyConfig']['energy'] = 500
                            inner_body['energyConfig']['maxEnergy'] = 500
                        
                        if 'trackingProperties' in inner_body:
                            inner_body['trackingProperties']['has_item_premium_subscription'] = True

                        # 使用 None 替代 del
                        inner_body['plusDiscounts'] = None
                        inner_body['adsConfig'] = None
                        
                        res['body'] = json.dumps(inner_body) # 将修改后的对象写回 body 字符串
                        
                    except Exception as e:
                        print(f"[PROXY] ❌ Sub-response {i} parsing failed: {e}")
        return response_obj
    except Exception as e:
        print(f"[PROXY] ❌ Error applying plus unlocks: {e}")
        return response_obj # 出错时返回原始对象


def create_upstream_request_and_get_response(method, url, headers, data, cookies):
    """创建一个上游请求并获取响应"""
    try:
        return requests.request(
            method=method,
            url=url,
            headers=headers,
            data=data,
            cookies=cookies,
            allow_redirects=False, # 让客户端处理重定向
            stream=True,
            timeout=20
        )
    except requests.exceptions.RequestException as e:
        print(f"[PROXY] ❌ Upstream request failed: {e}")
        return None

# =================================================================================
# 3. --- 主代理路由 ---
# =================================================================================
@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
def proxy(path):
    
    # --- 3.1 路由与请求拦截 ---
    path_parts = path.split('/')
    if not path_parts:
        return "Invalid path", 400

    target_host = path_parts[0]
    original_path = "/".join(path_parts[1:])
    
    # Analytics
    if "excess-api.duolingo.com" in target_host:
        print("[PROXY] Intercepting analytics request.")
        return "Successfully submitted 1 event(s)", 200

    # Static Images
    if "simg-ssl.duolingo.com" in target_host:
        print("[PROXY] BLOCKING request to simg-ssl.duolingo.com")
        return Response(None, 403, {"statusText": "Forbidden"})

    # Promotions
    if "ios-api-2.duolingo.cn" in target_host and original_path.startswith("plus-promotions/"):
        print("[PROXY] BLOCKING request to /plus-promotions/")
        return Response(None, 403, {"statusText": "Forbidden"})

    # Subscription Catalog
    if "ios-api-2.duolingo.cn" in target_host and "subscription-catalog" in original_path:
        print("[PROXY] Intercepting subscription-catalog request.")
        return Response("{}", 200, {'Content-Type': 'application/json'})

    print(f"[PROXY] Routing to: {target_host}, Path: /{original_path}")

    # --- 3.2 准备上游请求 ---
    upstream_url = f"https://{target_host}/{original_path}"
    client_headers = {key: value for (key, value) in request.headers if key.lower() != 'host'}
    client_headers['Host'] = target_host
    client_request_body = request.get_data()

    is_target_batch = False # Flag to indicate if we should modify the response

    # --- 3.3 请求修改与能量拦截 ---
    is_post = request.method == 'POST'
    is_batch_endpoint = original_path.endswith('2023-05-23/batch')

    if "ios-api-2.duolingo.cn" in target_host and is_post and is_batch_endpoint:
        body_str = client_request_body.decode('utf-8')
        
        # Energy Interception
        if "/remove-energy" in body_str or "/refill-energy" in body_str:
            return create_fake_energy_response(body_str)

        # Plus Unlock Request Modification
        if "gemsConfig" in body_str:
            print("[PROXY] Target batch request identified for modification.")
            is_target_batch = True
            try:
                req_obj = json.loads(body_str)
                if "requests" in req_obj and isinstance(req_obj["requests"], list):
                    for sub_req in req_obj["requests"]:
                        if sub_req.get("method") == 'GET' and "/users/" in sub_req.get("url", "") and "fields=" in sub_req.get("url", ""):
                            print("[PROXY] Mimicking PATCH for sub-request.")
                            url_parts = sub_req["url"].split('?')
                            base_url = url_parts[0]
                            params = dict(p.split('=') for p in url_parts[1].split('&'))
                            sub_req["method"] = "PATCH"
                            sub_req["url"] = base_url
                            sub_req["body"] = json.dumps({"fields": params.get("fields")})
                
                client_request_body = json.dumps(req_obj).encode('utf-8')
            except Exception as e:
                print(f"[PROXY] ❌ Error modifying request body: {e}")

    # --- 3.4 转发到上游 ---
    resp = create_upstream_request_and_get_response(
        request.method,
        upstream_url,
        client_headers,
        client_request_body,
        request.cookies
    )
    if resp is None:
        return "Proxy request to upstream failed", 502
    
    # --- 3.5 响应修改 ---
    # 如果不是我们的目标请求，则透明转发
    if not is_target_batch:
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(k, v) for k, v in resp.raw.headers.items() if k.lower() not in excluded_headers]
        return Response(resp.content, resp.status_code, headers)

    # 如果是，则执行解锁
    print("[PROXY] Applying Plus unlock modifications to response.")
    try:
        resp_obj = resp.json()
        modified_obj = apply_plus_unlock_modifications(resp_obj)
        
        final_body_bytes = json.dumps(modified_obj).encode('utf-8')
        
        final_headers = {key: value for (key, value) in resp.headers.items() if key.lower() not in ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'etag']}
        final_headers['Content-Length'] = str(len(final_body_bytes))
        
        return Response(final_body_bytes, resp.status_code, final_headers)
    
    except Exception as e:
        print(f"[PROXY] ❌ Error modifying response body: {e}. Passing through original response.")
        excluded_headers = ['transfer-encoding', 'connection']
        headers = [(k, v) for k, v in resp.raw.headers.items() if k.lower() not in excluded_headers]
        return Response(resp.raw, resp.status_code, headers)


# =================================================================================
# 4. --- 启动服务器 ---
# =================================================================================
if __name__ == '__main__':
    print("--- Duolingo Local Proxy by Gemini ---")
    print("--- Starting Flask server on 0.0.0.0:8787 ---")
    app.run(host='0.0.0.0', port=8787, threaded=True)
