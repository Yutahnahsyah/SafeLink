import { useCallback } from 'react';
import { apiRequest } from './apiClient';
import { useApiResource } from './useApiResource';
import { loadLguSafetyMap } from './lguSafetyMap.mjs';

export function useLguSafetyMap(user, jurisdiction) {
  const load = useCallback(() => loadLguSafetyMap(jurisdiction, apiRequest), [user?.id, user?.role, jurisdiction]);
  return useApiResource(load, [user?.id, user?.role, jurisdiction], {
    enabled: Boolean(user?.id && user.role === 'lgu_personnel' && jurisdiction && !user.isDevelopmentPreview),
    initialData: { features: [] }, live: ['incidents'],
  });
}
