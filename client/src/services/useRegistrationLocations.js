import { useEffect, useRef, useState } from 'react';
import { locationApi } from './safelinkApi';

export function useRegistrationLocations(kind, municipality, barangay = '', enabled = true) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ status: 'idle', data: [], key: '' });
  const cache = useRef(new Map());
  const key = `${kind}\0${municipality}\0${barangay}`;
  const active = enabled && Boolean(municipality) && (kind !== 'streets' || Boolean(barangay));
  useEffect(() => {
    if (!active) return undefined;
    if (cache.current.has(key)) { setResult({ status: 'success', data: cache.current.get(key), key }); return undefined; }
    let current = true;
    const controller = new AbortController();
    setResult({ status: 'loading', data: [], key });
    const timer = setTimeout(async () => {
      try {
        const payload = kind === 'barangays' ? await locationApi.barangays(municipality, { signal: controller.signal }) : await locationApi.streets(municipality, barangay, { signal: controller.signal });
        if (!Array.isArray(payload.data)) throw new Error('Location data could not be loaded.');
        if (current) { cache.current.set(key, payload.data); setResult({ status: 'success', data: payload.data, key }); }
      } catch (error) {
        if (current && error.name !== 'AbortError') setResult({ status: 'error', data: [], error, key });
      }
    }, kind === 'streets' ? 300 : 0);
    return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [key, active, revision]);
  const retry = () => { cache.current.delete(key); setRevision((value) => value + 1); };
  if (!active) return { status: 'idle', data: [], retry };
  return { ...(result.key === key ? result : { status: 'loading', data: [] }), retry };
}
