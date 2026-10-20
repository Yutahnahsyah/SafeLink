import LocationCombobox from './LocationCombobox';
import { useRegistrationLocations } from '../../services/useRegistrationLocations';
import { filterStreetSuggestions } from '../../services/registrationLocationState';

export default function CitizenLocationFields({ values, update, touch, errors, touched, barangays, selectStreet }) {
  const selectedBarangay = barangays.status === 'success' && barangays.data.some((item) => item.name === values.barangay);
  const streets = useRegistrationLocations('streets', values.municipalityOrCity, values.barangay, selectedBarangay && values.street.trim().length >= 2);
  const matches = filterStreetSuggestions(streets.data, values.street);
  return <>
    <LocationCombobox key={values.municipalityOrCity} id="registration-barangay" label="Barangay" value={values.barangay} onChange={update('barangay')} onBlur={() => touch('barangay')} options={barangays.data.map((item) => item.name)} status={barangays.status} retry={barangays.retry} error={errors.barangay} touched={touched.barangay} disabled={!values.municipalityOrCity || barangays.status === 'loading'} placeholder="Search and select your barangay" emptyText="No matching barangays found." helper={!values.municipalityOrCity ? 'Select a city or municipality first.' : barangays.status === 'loading' ? 'Loading barangays…' : 'Choose a barangay from the municipality list.'} />
    <LocationCombobox key={`${values.municipalityOrCity}:${values.barangay}`} id="registration-street" label="Street Address" value={values.street} onChange={update('street')} onSelect={selectStreet} onBlur={() => { if (values.street !== values.street.trim()) update('street')(values.street.trim()); touch('street'); }} options={matches} status={streets.status} retry={streets.retry} error={errors.street} touched={touched.street} freeText disabled={!selectedBarangay} maxLength={255} placeholder="Enter your street name" emptyText={values.street.trim().length < 2 ? 'Type at least two characters for suggestions.' : 'No matching streets found. You can enter your street manually.'} helper={!selectedBarangay ? 'Select your barangay first.' : 'Street Address is required. Suggestions are optional; manually entered streets are not geographically verified.'} source />
  </>;
}
