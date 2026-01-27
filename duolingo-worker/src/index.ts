/**
 * Duolingo Unlocker Worker (Request Mimic Version - Fixed)
 * 
 * 核心逻辑：
 * 1. 仅对 POST 请求（Batch）进行拦截和伪装。
 * 2. 对 GET 子请求伪装成 PATCH：
 *    - 方法: GET -> PATCH
 *    - URL: 移除 ?fields=...
 *    - Body: 将 fields 内容存入 {"fields": "..."}
 * 3. 拦截 analytics (excess.duolingo.com) 请求并返回假成功响应
 */

export interface Env {}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        console.log(`\n---\n[WORKER] Incoming: ${request.method} ${request.url}`);

        const url = new URL(request.url);

        // 1. Routing Logic: Determine target host based on path prefix
        let targetHost = '';
        const iosApiPrefix = '/ios-api-2';
        const goalsApiPrefix = '/goals-api';
        const excessApiPrefix = '/excess-api';

        if (url.pathname.startsWith(iosApiPrefix + '/')) {
            targetHost = 'ios-api-2.duolingo.cn';
            url.pathname = url.pathname.substring(iosApiPrefix.length);
        } else if (url.pathname.startsWith(goalsApiPrefix + '/')) {
            targetHost = 'goals-api.duolingo.cn';
            url.pathname = url.pathname.substring(goalsApiPrefix.length);
        } else if (url.pathname.startsWith(excessApiPrefix)) {
            // This is an analytics request, intercept and fake a success response
            console.log('[WORKER] Intercepting analytics request to excess.duolingo.com');

            // This is an analytics request, intercept and fake a success response
            console.log('[WORKER] Intercepting analytics request to excess.duolingo.com and faking success.');

            // Always return a fixed success message, no need to parse the body
            const responseMessage = 'Successfully submitted 1 event(s)'; // A generic success message

            return new Response(responseMessage, {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain;charset=iso-8859-1',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization',
                    'Access-Control-Max-Age': '3600',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                }
            });
        }
        
        else {
            return new Response('Request not routed. Use /ios-api-2/, /goals-api/, or /excess-api/ path prefix.', { status: 404 });
        }
        
        console.log(`[WORKER] Routing to target host: ${targetHost}, new path: ${url.pathname}`);

        // Set upstream URL details
        url.hostname = targetHost;
        url.protocol = 'https';

        const headersForUpstream = new Headers(request.headers);
        headersForUpstream.set('Host', targetHost);

        // 2. Host-specific Modifications
        let modifiedRequestBody: string | null = null;
        let isTargetBatch = false; // Flag for ios-api-2 batch modifications

        // Only apply modifications for ios-api-2.duolingo.cn
        if (targetHost === 'ios-api-2.duolingo.cn') {
            // Intercept subscription-catalog requests and return empty JSON
            const userSubscriptionCatalogRegex = /^\/2023-05-23\/users\/[0-9]+\/subscription-catalog/;
            if (userSubscriptionCatalogRegex.test(url.pathname)) {
                console.log('[WORKER] Intercepted subscription-catalog request for ios-api-2. Returning empty JSON.');
                return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            // Intercept the main user data batch request for modification
            const isPost = request.method === 'POST';
            const isBatchEndpoint = url.pathname === '/2023-05-23/batch';

            if (isPost && isBatchEndpoint) {
                try {
                    // Must clone request to read body, as it can only be read once.
                    const requestClone = request.clone();
                    let requestBody = await requestClone.text();
                    
                    // The user confirmed that 'gemsConfig' is the unique identifier for the target batch request
                    // within the POST /batch endpoint.
                    isTargetBatch = requestBody.includes('gemsConfig');

                    if (isTargetBatch) {
                        modifiedRequestBody = requestBody; // Start with original body
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
                                        return { ...subReq, method: 'PATCH', url: baseUrl, body: JSON.stringify({ fields: fields }) };
                                    }
                                }
                                return subReq;
                            });
                            modifiedRequestBody = JSON.stringify(reqObj);
                        }
                    }
                } catch (e) {
                    console.error('[WORKER] Error parsing POST body for ios-api-2:', e);
                }
            }
        }

        // 3. Fetch from Upstream
        const upstreamRequest = new Request(url.toString(), {
            method: request.method,
            headers: headersForUpstream,
            redirect: 'follow',
            body: modifiedRequestBody ?? (request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null),
        });

        let response = await fetch(upstreamRequest);
        
        // 4. Response Modification (only for specific ios-api-2 batch requests)
        if (!isTargetBatch) { // isTargetBatch is only true for the specific ios-api-2 request
            return response;
        }

        // The rest of this function is only for the target ios-api-2 batch response
        if (!response.headers.get("content-type")?.includes("application/json")) {
            return response;
        }

        try {
            let obj: any = await response.json();
            if (obj.responses && Array.isArray(obj.responses)) {
                obj.responses.forEach((res: any, idx: number) => {
                    if (res.body && typeof res.body === 'string' && (res.body.includes('subscriberLevel') || res.body.includes('energyConfig'))) {
                        console.log(`[WORKER] Modifying sub-response ${idx} for ios-api-2`);
                        try {
                            let innerBody = JSON.parse(res.body);
                            
                            innerBody.subscriberLevel = "MAX";
                            innerBody.hasPlus = true;
                            if (innerBody.energyConfig) {
                                innerBody.energyConfig.energy = 50;
                                innerBody.energyConfig.maxEnergy = 50;
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
            console.log('[WORKER] Error parsing final response body for ios-api-2:', e);
            return response; // Return original on failure
        }
    },
};
