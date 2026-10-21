import { useCallback } from 'react';
import { apiRequest } from './apiClient';
import { useApiResource } from './useApiResource';
import { getLguMapView } from '../lguScope';

export function useLguSafetyMap(user, jurisdiction) {
  const load = useCallback(async () => {
    const [payload, boundary] = await Promise.all([
      apiRequest('incidents/map'), apiRequest('incidents/map/boundary'),
    ]);
    if (!getLguMapView(jurisdiction, boundary)) throw new Error('The assigned LGU jurisdiction has no matching boundary. Ask your administrator to check the municipality or city.');
    return { ...payload, boundary };
  }, [user?.id, user?.role, jurisdiction]);
  return useApiResource(load, [user?.id, user?.role, jurisdiction], {
    enabled: Boolean(user?.id && user.role === 'lgu_personnel' && jurisdiction && !user.isDevelopmentPreview),
    initialData: { features: [] }, live: ['incidents'],
  });
}
