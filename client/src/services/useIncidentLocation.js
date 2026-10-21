import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from './reverseGeocode.js';
import { getPangasinanZipCode } from '../data/pangasinanLocations.js';
import { validateIncidentCoordinates } from '../../../shared/incidentProvince.mjs';
import { loadIncidentMunicipality } from './incidentMunicipality.js';

export function useIncidentLocation({ values, setValues, setErrors, setNotice }) {
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [geography, setGeography] = useState(null);
  useEffect(() => {
    let active = true;
    loadIncidentMunicipality().then(reference => { if (active) setGeography(reference); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const revision = useRef(0), controller = useRef(null);
  const pending = useRef(false), gpsTimer = useRef(null);
  const accuracyMessage = useRef('');
  const emptyAddress = { province: '', municipalityOrCity: '', barangay: '', street: '', zipCode: '', location: '' };
  const selectedPoint = useRef(values.latitude !== '' && values.longitude !== ''
    ? { latitude: Number(values.latitude), longitude: Number(values.longitude) } : null);
  const manualFields = useRef(new Set(Object.keys(emptyAddress).filter((field) => values[field])));
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
    if (event.target.value === values[key]) return;
    cancel();
    const value = event.target.value;
    manualFields.current.add(key);
    setValues((current) => ({ ...current, [key]: value,
      ...(key === 'barangay' ? { street: '', location: '', pinNeedsConfirmation: true } : {}) }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setLocationFeedback(key === 'barangay'
      ? { type: 'error', text: 'Barangay boundaries are unavailable. Check the selected barangay against the map and confirm the pin, or select the exact incident location on the map.' }
      : accuracyMessage.current ? { type: 'success', text: `${accuracyMessage.current} Please verify the barangay and map pin before continuing.` } : null);
    setNotice('');
  };
  const setMunicipality = async (event) => {
    if (event.target.value === values.municipalityOrCity) return;
    cancel();
    const municipalityOrCity = event.target.value;
    const request = revision.current;
    setGeocoding(true);
    setLocationFeedback({ type: 'loading', text: 'Loading municipality boundaries…' });
    let reference;
    try { reference = await loadIncidentMunicipality(); }
    catch {
      if (request === revision.current) {
        setGeocoding(false);
        setLocationFeedback({ type: 'error', text: 'Municipality boundaries could not load. Please retry your selection.' });
      }
      return;
    }
    if (request !== revision.current) return;
    setGeography(reference);
    setGeocoding(false);
    accuracyMessage.current = '';
    manualFields.current.clear();
    manualFields.current.add('municipalityOrCity');
    const keepPin = selectedPoint.current && reference.municipalitiesAt(selectedPoint.current).includes(municipalityOrCity);
    if (!keepPin) selectedPoint.current = null;
    setValues((current) => ({ ...current, municipalityOrCity, barangay: '', zipCode: getPangasinanZipCode(municipalityOrCity),
      street: '', location: '', pinNeedsConfirmation: false,
      ...(!keepPin ? { latitude: '', longitude: '' } : {}) }));
    const bounds = reference.municipalityBounds(municipalityOrCity);
    setMapFocus(bounds ? { bounds, id: revision.current } : null);
    setErrors((current) => ({ ...current, municipalityOrCity: '', barangay: '', coordinates: '' }));
    setLocationFeedback({ type: keepPin ? 'success' : 'error', text: keepPin
      ? 'The existing pin is within the selected municipality. Select and confirm its barangay.'
      : 'Select the exact incident location on the map.' });
    setNotice('');
  };
  const setCoordinates = async ({ latitude, longitude, accuracy }, source = 'manual') => {
    cancel();
    const request = revision.current;
    const boundaryError = validateIncidentCoordinates({ latitude, longitude });
    if (boundaryError) {
      if (source === 'current') {
        selectedPoint.current = null;
        manualFields.current.clear();
        accuracyMessage.current = '';
        setValues((current) => ({ ...current, ...emptyAddress, latitude: '', longitude: '' }));
        setMapFocus(null);
        setErrors((current) => ({ ...current, coordinates: boundaryError }));
      }
      setLocationFeedback({ type: 'error', text: boundaryError });
      return;
    }
    pending.current = true;
    const samePoint = selectedPoint.current?.latitude === latitude && selectedPoint.current?.longitude === longitude;
    selectedPoint.current = { latitude, longitude };
    if (!samePoint) manualFields.current.clear();
    // A retry at the same pin must not erase confirmed details. Any moved pin
    // needs a fresh address: even a small move can cross a barangay boundary.
    setValues((current) => ({ ...current, ...(!samePoint ? emptyAddress : {}), province: 'Pangasinan',
      latitude: String(latitude), longitude: String(longitude), pinNeedsConfirmation: false }));
    setErrors((current) => ({ ...current, coordinates: '' }));
    setSelectionRevision((current) => current + 1);
    if (source === 'current') setMapFocus({ latitude, longitude, id: request });
    else setMapFocus(null);
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
      const address = await reverseGeocode({ latitude, longitude, accuracy: source === 'current' ? accuracy : 0, signal: abort.signal,
        onMunicipality: (municipalityOrCity, zipCode) => {
          if (request !== revision.current) return;
          if (values.municipalityOrCity !== municipalityOrCity) manualFields.current.clear();
          setValues((current) => {
            if (request !== revision.current || current.municipalityOrCity === municipalityOrCity) return current;
            return { ...current, ...emptyAddress, province: 'Pangasinan', municipalityOrCity, zipCode,
              location: `${municipalityOrCity}, Pangasinan` };
          });
        },
      });
      if (request !== revision.current) return;
      setValues((current) => {
        if (request !== revision.current) return current;
        const cityChanged = Boolean(address.municipalityOrCity && current.municipalityOrCity
          && address.municipalityOrCity !== current.municipalityOrCity);
        const barangayChanged = Boolean(address.barangay && current.barangay && address.barangay !== current.barangay);
        const next = { ...current };
        if (cityChanged) Object.assign(next, emptyAddress, { province: 'Pangasinan' });
        else if (barangayChanged) Object.assign(next, { barangay: '', street: '', location: '' });
        for (const field of Object.keys(emptyAddress)) {
          if (field === 'province' || typeof address[field] !== 'string' || !address[field].trim()) continue;
          const scopeChanged = cityChanged || (barangayChanged && ['barangay', 'street', 'location'].includes(field));
          if (!scopeChanged && manualFields.current.has(field)) continue;
          next[field] = address[field];
        }
        return next;
      });
      setErrors((current) => ({ ...current, municipalityOrCity: '', barangay: '', street: '', zipCode: '', location: '' }));
      const labels = { municipalityOrCity: 'municipality/city', barangay: 'barangay', zipCode: 'ZIP code', street: 'street', location: 'nearby landmark or location details' };
      const detected = Object.entries(labels).filter(([field]) => address[field]).map(([, label]) => label);
      const missing = Object.entries(labels)
        .filter(([field]) => !address[field]).map(([, label]) => label);
      setLocationFeedback({ type: address.municipalityOrCity && address.barangay ? 'success' : 'error',
        text: `${uncertainty} Province: Pangasinan.${address.warning ? ` ${address.warning}` : ''}${detected.length ? ` Detected ${detected.join(', ')}.` : ''} Please verify the barangay and map pin before continuing.${samePoint ? ' Manual corrections for this pin are kept unless the detected municipality or barangay conflicts.' : ' Previous address details were revalidated for the new pin.'}${missing.length ? ` Could not confirm ${missing.join(', ')}; complete or confirm these fields manually (street and ZIP are optional).` : ''}` });
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
  const coordinateError = () => validateIncidentCoordinates(values)
    || (!geography ? 'Location boundaries are loading. Please retry shortly.' : geography.validateMunicipalityCoordinates(values))
    || (values.pinNeedsConfirmation ? 'Confirm the map pin for the selected barangay before continuing.' : '');
  const confirmPin = async () => {
    const request = revision.current;
    let reference;
    try { reference = await loadIncidentMunicipality(); }
    catch { setLocationFeedback({ type: 'error', text: 'Municipality boundaries could not load. Please retry.' }); return; }
    if (request !== revision.current) return;
    setGeography(reference);
    const error = validateIncidentCoordinates(values) || reference.validateMunicipalityCoordinates(values);
    if (error || !values.barangay) {
      setErrors(current => ({ ...current, coordinates: error || 'Select the barangay before confirming the pin.' }));
      return;
    }
    cancel();
    setValues(current => ({ ...current, pinNeedsConfirmation: false }));
    setErrors(current => ({ ...current, coordinates: '' }));
    setLocationFeedback({ type: 'success', text: 'Map pin manually confirmed for the selected barangay. Verify the address before continuing.' });
  };
  return { locating, geocoding, locationFeedback, mapFocus, selectionRevision, useLocation, setCoordinates, editAddress, setMunicipality, confirmPin, coordinateError };
}
