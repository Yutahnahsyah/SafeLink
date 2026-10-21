import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from './reverseGeocode.js';
import { getPangasinanZipCode } from '../data/pangasinanLocations.js';
import { validateIncidentCoordinates } from '../../../shared/incidentProvince.mjs';

export function useIncidentLocation({ values, setValues, setErrors, setNotice }) {
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const revision = useRef(0), controller = useRef(null);
  const pending = useRef(false), gpsTimer = useRef(null);
  const accuracyMessage = useRef('');
  const emptyAddress = { province: '', municipalityOrCity: '', barangay: '', street: '', zipCode: '', location: '' };
  useEffect(() => () => { revision.current++; controller.current?.abort(); window.clearTimeout(gpsTimer.current); pending.current = false; }, []);

  const cancel = () => {
    revision.current++;
    controller.current?.abort();
    window.clearTimeout(gpsTimer.current);
    pending.current = false;
    setLocating(false);
    setGeocoding(false);
  };
  const editAddress = (key) => (event) => {
    cancel();
    const value = event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setLocationFeedback(accuracyMessage.current ? { type: 'success', text: `${accuracyMessage.current} Please verify the barangay and map pin before continuing.` } : null);
    setNotice('');
  };
  const setMunicipality = (event) => {
    cancel();
    const municipalityOrCity = event.target.value;
    accuracyMessage.current = '';
    setValues((current) => ({ ...current, municipalityOrCity, barangay: '', zipCode: getPangasinanZipCode(municipalityOrCity),
      ...(current.municipalityOrCity !== municipalityOrCity ? { province: '', latitude: '', longitude: '', street: '', location: '' } : {}) }));
    setMapFocus(null);
    setErrors((current) => ({ ...current, municipalityOrCity: '', barangay: '', coordinates: '' }));
    setLocationFeedback({ type: 'success', text: 'Municipality updated. Select the barangay and confirm the incident position on the map.' });
    setNotice('');
  };
  const setCoordinates = async ({ latitude, longitude, accuracy }, source = 'manual') => {
    cancel();
    const request = revision.current;
    const boundaryError = validateIncidentCoordinates({ latitude, longitude });
    if (boundaryError) {
      if (source === 'current') {
        accuracyMessage.current = '';
        setValues((current) => ({ ...current, ...emptyAddress, latitude: '', longitude: '' }));
        setMapFocus(null);
        setErrors((current) => ({ ...current, coordinates: boundaryError }));
      }
      setLocationFeedback({ type: 'error', text: boundaryError });
      return;
    }
    pending.current = true;
    // Replace the old address at the same time as the pin, even if lookup fails.
    setValues((current) => ({ ...current, ...emptyAddress, province: 'Pangasinan',
      latitude: String(latitude), longitude: String(longitude) }));
    setErrors((current) => ({ ...current, coordinates: '' }));
    setSelectionRevision((current) => current + 1);
    if (source === 'current') setMapFocus({ latitude, longitude, id: request });
    const uncertainty = source === 'current'
      ? Number.isFinite(accuracy) && accuracy >= 0 ? `Location detected with approximately ${Math.ceil(accuracy)} m accuracy.` : 'Location detected; GPS accuracy is unknown.'
      : 'Pinned location updated.';
    accuracyMessage.current = source === 'current' ? uncertainty : '';
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 10000);
    setGeocoding(true);
    setLocationFeedback({ type: 'loading', text: 'Finding address…' });
    try {
      const address = await reverseGeocode({ latitude, longitude, accuracy: source === 'current' ? accuracy : 0, signal: abort.signal });
      if (request !== revision.current) return;
      setValues((current) => ({ ...current, ...Object.fromEntries(
        Object.keys(emptyAddress).filter((field) => field !== 'province').map((field) => [field, typeof address[field] === 'string' ? address[field] : ''])
      ) }));
      setErrors((current) => ({ ...current, municipalityOrCity: '', barangay: '', street: '', zipCode: '', location: '' }));
      const labels = { municipalityOrCity: 'municipality/city', barangay: 'barangay', zipCode: 'ZIP code', street: 'street', location: 'nearby landmark or location details' };
      const detected = Object.entries(labels).filter(([field]) => address[field]).map(([, label]) => label);
      const missing = Object.entries(labels)
        .filter(([field]) => !address[field]).map(([, label]) => label);
      setLocationFeedback({ type: address.municipalityOrCity && address.barangay ? 'success' : 'error',
        text: `${uncertainty} Province: Pangasinan.${detected.length ? ` Detected ${detected.join(', ')}.` : ''} Please verify the barangay and map pin before continuing.${missing.length ? ` Could not confirm ${missing.join(', ')}; complete or correct these fields manually (street and ZIP are optional).` : ''}` });
    } catch (error) {
      if (request !== revision.current) return;
      // The actual polygon already validated this pin; provider failures must not restore an old location.
      setLocationFeedback({ type: 'error', text: `${uncertainty} ${error?.name === 'AbortError'
        ? 'Address detection took too long. The pin is saved; enter the address manually or retry.'
        : 'The location is pinned, but address detection is unavailable. Enter or verify the address manually, or retry shortly.'}` });
    } finally {
      window.clearTimeout(timeout);
      if (request === revision.current) { pending.current = false; setGeocoding(false); }
    }
  };
  const useLocation = () => {
    if (pending.current) return;
    cancel();
    if (window.isSecureContext === false) {
      setLocationFeedback({ type: 'error', text: 'Current location requires HTTPS or localhost. Open SafeLink using a secure connection, or select the incident position manually on the map.' });
      return;
    }
    if (!navigator.geolocation?.getCurrentPosition) {
      setLocationFeedback({ type: 'error', text: 'Location services are unavailable in this browser. Select the incident position on the map and enter the address manually.' });
      return;
    }
    const request = revision.current;
    pending.current = true;
    setLocating(true);
    setLocationFeedback({ type: 'loading', text: 'Detecting your current location…' });
    const fail = (error) => {
      if (request !== revision.current) return;
      pending.current = false;
      window.clearTimeout(gpsTimer.current);
      setLocating(false);
      setLocationFeedback({ type: 'error', text: error?.code === 1
        ? 'Location permission was denied or blocked. Allow location in your browser/site and device settings, then retry. If SafeLink is embedded, open it directly. You can also select the incident position manually on the map.'
        : error?.code === 3 ? 'Location detection took too long. Try again or select the location manually.'
          : 'Your position is unavailable. Check location services, or select the incident position manually on the map.' });
    };
    const acquire = (highAccuracy) => {
      let settled = false;
      const failure = (error) => {
        if (settled || request !== revision.current) return;
        settled = true;
        window.clearTimeout(gpsTimer.current);
        if (highAccuracy && [2, 3].includes(error?.code)) {
          setLocationFeedback({ type: 'loading', text: 'Precise GPS is unavailable. Trying the device’s other location services…' });
          acquire(false);
        } else fail(error);
      };
      // A wall-clock guard also releases loading when a browser/provider never calls back.
      gpsTimer.current = window.setTimeout(() => failure({ code: 3 }), 30000);
      try {
        navigator.geolocation.getCurrentPosition((position) => {
          if (settled || request !== revision.current) return;
          settled = true;
          window.clearTimeout(gpsTimer.current);
          const coords = position?.coords;
          if (!Number.isFinite(coords?.latitude) || !Number.isFinite(coords?.longitude)
            || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) { fail({ code: 2 }); return; }
          void setCoordinates({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }, 'current');
        }, failure, { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 0 });
      } catch (error) { failure(error); }
    };
    acquire(true);
  };
  return { locating, geocoding, locationFeedback, mapFocus, selectionRevision, useLocation, setCoordinates, editAddress, setMunicipality };
}
