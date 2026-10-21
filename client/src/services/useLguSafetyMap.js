import { useCallback } from 'react';
import { apiRequest } from './apiClient';
import { useApiResource } from './useApiResource';

export function useLguSafetyMap(user, jurisdiction) {
  const load = useCallback(() => apiRequest('incidents/map'), [user?.id, jurisdiction]);
  return useApiResource(load, [user?.id, jurisdiction], {
    enabled: Boolean(user?.id && user.role === 'lgu_personnel' && jurisdiction && !user.isDevelopmentPreview),
    initialData: { features: [] }, live: ['incidents'],
  });
}
