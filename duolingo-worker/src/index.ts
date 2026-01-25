/**
 * Duolingo Unlocker Worker (Request Mimic Version - Fixed)
 * 
 * 核心逻辑：
 * 1. 仅对 POST 请求（Batch）进行拦截和伪装。
 * 2. 对 GET 子请求伪装成 PATCH：
 *    - 方法: GET -> PATCH
 *    - URL: 移除 ?fields=...
 *    - Body: 将 fields 内容存入 {"fields": "..."}
 */

export interface Env {}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        console.log(`\n---\n[WORKER] Incoming: ${request.method} ${request.url}`);

        const targetHost = 'ios-api-2.duolingo.cn';
        const url = new URL(request.url);
        url.hostname = targetHost;
        url.protocol = 'https';

        const headersForUpstream = new Headers(request.headers);
        headersForUpstream.set('Host', targetHost);

        let isPost = request.method === 'POST';
        let modifiedRequestBody: string | null = null;
        let isTargetBatch = false;

        if (isPost) {
            try {
                const requestClone = request.clone();
                let requestBody = await requestClone.text();
                isTargetBatch = requestBody.includes('gemsConfig');
                modifiedRequestBody = requestBody;

                if (isTargetBatch) {
                    let reqObj = JSON.parse(requestBody);
                    if (reqObj.requests && Array.isArray(reqObj.requests)) {
                        reqObj.requests = reqObj.requests.map((subReq: any) => {
                            if (subReq.method === 'GET' && subReq.url.includes('/users/') && subReq.url.includes('fields=')) {
                                console.log(`[WORKER] Mimicking PATCH for sub-request: ${subReq.url.substring(0, 40)}...`);
                                
                                const urlParts = subReq.url.split('?');
                                const baseUrl = urlParts[0];
                                const queryString = urlParts[1] || '';
                                
                                const params = new URLSearchParams(queryString);
                                const fields = params.get('fields');

                                if (fields) {
                                    return {
                                        ...subReq,
                                        method: 'PATCH',
                                        url: baseUrl,
                                        body: JSON.stringify({ fields: fields })
                                    };
                                }
                            }
                            return subReq;
                        });
                        modifiedRequestBody = JSON.stringify(reqObj);
                    }
                }
            } catch (e) {
                console.error('[WORKER] Error parsing POST body:', e);
            }
        }

        // 修复点：GET 请求不能有 body 字段
        const requestOptions: RequestInit = {
            method: request.method,
            headers: headersForUpstream,
            redirect: 'follow'
        };

        if (isPost && modifiedRequestBody !== null) {
            requestOptions.body = modifiedRequestBody;
        }

        const upstreamRequest = new Request(url.toString(), requestOptions);
        let response = await fetch(upstreamRequest);
        
        if (!isTargetBatch || !response.headers.get("content-type")?.includes("application/json")) {
            return response;
        }

        try {
            let obj: any = await response.json();
            if (obj.responses && Array.isArray(obj.responses)) {
                obj.responses.forEach((res: any, idx: number) => {
                    if (res.body && typeof res.body === 'string' && (res.body.includes('subscriberLevel') || res.body.includes('energyConfig'))) {
                        console.log(`[WORKER] Modifying sub-response ${idx}`);
                        try {
                            let innerBody = JSON.parse(res.body);
                            
                            innerBody.subscriberLevel = "STANDARD";
                            innerBody.hasPlus = true;
                            if (innerBody.energyConfig) {
                                innerBody.energyConfig.energy = 1000;
                                innerBody.energyConfig.maxEnergy = 1000;
                            }
                            if (innerBody.trackingProperties) {
                                innerBody.trackingProperties.has_item_premium_subscription = true;
                            }
                            delete innerBody.plusDiscounts;
                            delete innerBody.adsConfig;

                            res.body = JSON.stringify(innerBody);

                            if (res.headers) {
                                delete res.headers['content-encoding'];
                                delete res.headers['content-length'];
                            }
                        } catch (e) {
                            console.log(`[WORKER] Sub-response ${idx} parsing failed:`, e);
                        }
                    }
                });
            }

            const finalBody = JSON.stringify(obj);
            const finalHeaders = new Headers(response.headers);
            finalHeaders.delete('content-encoding');
            finalHeaders.delete('content-length');

            return new Response(finalBody, {
                status: response.status,
                headers: finalHeaders
            });
        } catch (e) {
            return response;
        }
    },
};
