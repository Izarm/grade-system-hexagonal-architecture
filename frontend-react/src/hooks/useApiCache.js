import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const cache = new Map();
const TTL_MS = 60 * 1000;

export function useApiCache(url, options = {}) {
    const { ttl = TTL_MS, enabled = true } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!enabled || !url) return;
        const cached = cache.get(url);
        if (cached && Date.now() - cached.ts < ttl) {
            setData(cached.data);
            setLoading(false);
            return;
        }
        setLoading(true);
        api.get(url)
            .then(res => {
                const result = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data);
                cache.set(url, { data: result, ts: Date.now() });
                if (mountedRef.current) { setData(result); setLoading(false); }
            })
            .catch(err => {
                if (mountedRef.current) { setError(err); setLoading(false); }
            });
    }, [url, enabled, ttl]);

    const invalidate = () => { cache.delete(url); };

    return { data, loading, error, invalidate };
}

export function clearCache(urlPattern) {
    if (!urlPattern) { cache.clear(); return; }
    for (const key of cache.keys()) {
        if (key.includes(urlPattern)) cache.delete(key);
    }
}
