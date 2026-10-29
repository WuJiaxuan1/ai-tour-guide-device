import AMapLoader from '@amap/amap-jsapi-loader';

export const mapKey = import.meta.env.VITE_AMAP_KEY?.trim() || '';
export const mapServiceHost = import.meta.env.VITE_AMAP_SERVICE_HOST?.trim() || '';
let loading;

export async function loadAMap() {
  if (!mapKey || !mapServiceHost) {
    return Promise.reject(new Error('MAP_NOT_CONFIGURED'));
  }
  if (!loading) {
    const proxy = new URL(mapServiceHost, window.location.origin);
    if (!['http:', 'https:'].includes(proxy.protocol) || !proxy.pathname.endsWith('/_AMapService')) {
      return Promise.reject(new Error('MAP_PROXY_INVALID'));
    }
    // Set before loading the SDK. The securityJsCode stays on the server.
    window._AMapSecurityConfig = {serviceHost: proxy.href};
    loading = AMapLoader.load({key: mapKey, version: '2.0'});
  }
  return loading;
}
