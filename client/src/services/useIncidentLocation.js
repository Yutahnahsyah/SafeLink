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
  const accuracyMessage = useRef('');
  useEffect(() => () => { revision.current++; controller.current?.abort(); }, []);

  const cancel = () => {
    revision.current++;
    controller.current?.abort();
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
      ...(current.municipalityOrCity !== municipalityOrCity ? { latitude: '', longitude: '', street: '', location: '' } : {}) }));
    setMapFocus(null);
    setErrors((current) => ({ ...current, municipalityOrCity: '', barangay: '', coordinates: '' }));
    setLocationFeedback({ type: 'success', text: 'Municipality updated. Select the barangay and confirm the incident position on the map.' });
    setNotice('');
  };
  const setCoordinates = async ({ latitude, longitude, accuracy }, source = 'manual') => {
    cancel();
    const request = revision.current;
    const boundaryError = source !== 'current' && validateIncidentCoordinates({ latitude, longitude });
    if (boundaryError) {
      setLocationFeedback({ type: 'error', text: boundaryError });
      return;
    }
    // Current Location acquisition remains unchanged; submissions validate every pin.
    if (source === 'current' && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 15.61 || latitude > 16.4 || longitude < 119.75 || longitude > 120.93)) {
      setLocationFeedback({ type: 'error', text: 'That point is outside Pangasinan. Choose the incident location manually on the map.' });
      return;
    }
    const previous = { latitude: values.latitude, longitude: values.longitude };
    setValues((current) => ({ ...current,
      latitude: source === 'current' ? latitude.toFixed(6) : String(latitude),
      longitude: source === 'current' ? longitude.toFixed(6) : String(longitude) }));
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
      setValues((current) => ({ ...current, ...address }));
      setErrors((current) => ({ ...current, municipalityOrCity: '', barangay: '', street: '', zipCode: '', location: '' }));
      const labels = { municipalityOrCity: 'municipality/city', barangay: 'barangay', zipCode: 'ZIP code', street: 'street', location: 'nearby landmark or location details' };
      const detected = Object.entries(labels).filter(([field]) => address[field]).map(([, label]) => label);
      const missing = Object.entries(labels)
        .filter(([field]) => !address[field]).map(([, label]) => label);
      setLocationFeedback({ type: address.municipalityOrCity && address.barangay ? 'success' : 'error',
        text: `${uncertainty}${detected.length ? ` Detected ${detected.join(', ')}.` : ''} Please verify the barangay and map pin before continuing.${missing.length ? ` Could not confirm ${missing.join(', ')}; complete or correct these fields manually (street and ZIP are optional).` : ''}` });
    } catch (error) {
      if (request !== revision.current) return;
      // Address lookup cannot override polygon validation of a manual pin.
      if (error?.code === 'OUTSIDE_PANGASINAN' && source === 'current') {
        setValues((current) => ({ ...current, ...previous }));
        setMapFocus(previous.latitude && previous.longitude ? { latitude: Number(previous.latitude), longitude: Number(previous.longitude), id: request + 0.5 } : null);
        setLocationFeedback({ type: 'error', text: 'That point is outside Pangasinan. Choose the incident location manually on the map.' });
      } else {
        setLocationFeedback({ type: 'error', text: `${uncertainty} ${error?.name === 'AbortError'
          ? 'Address detection took too long. The pin is saved; enter the address manually or retry.'
          : 'The location is pinned, but address detection is unavailable. Enter or verify the address manually, or retry shortly.'}` });
      }
    } finally {
      window.clearTimeout(timeout);
      if (request === revision.current) setGeocoding(false);
    }
  };
  const useLocation = () => {
    if (locating || geocoding) return;
    cancel();
    if (!navigator.geolocation) {
      setLocationFeedback({ type: 'error', text: 'Location services are unavailable in this browser. Select the incident position on the map and enter the address manually.' });
      return;
    }
    const request = revision.current;
    setLocating(true);
    setLocationFeedback({ type: 'loading', text: 'Detecting your current location…' });
    const fail = (error) => {
      if (request !== revision.current) return;
      setLocating(false);
      setLocationFeedback({ type: 'error', text: error?.code === 1
        ? 'Location access was denied. You can still select the incident position on the map and enter the address manually.'
        : error?.code === 3 ? 'Location detection took too long. Try again or select the location manually.'
          : 'Your position is unavailable. Check location services, or select the incident position manually on the map.' });
    };
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (request !== revision.current) return;
        void setCoordinates({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }, 'current');
      }, fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    } catch (error) { fail(error); }
  };
  return { locating, geocoding, locationFeedback, mapFocus, selectionRevision, useLocation, setCoordinates, editAddress, setMunicipality };
}
