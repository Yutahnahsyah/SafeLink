import { CatmullRomCurve3, Quaternion, Vector3 } from "three";

// Y is north; longitude zero faces +Z. Use the same convention for all layers.
export function latLngToVector3(lat, lng, radius = 1) {
  const latitude = (lat * Math.PI) / 180;
  const longitude = (lng * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(latitude) * Math.sin(longitude),
    radius * Math.sin(latitude),
    radius * Math.cos(latitude) * Math.cos(longitude),
  );
}

export function orientationForLocation(lat, lng) {
  return new Quaternion().setFromUnitVectors(
    latLngToVector3(lat, lng).normalize(),
    new Vector3(0, 0, 1),
  );
}

export function createArc(
  startLat,
  startLng,
  endLat,
  endLng,
  height = 0.25,
  radius = 1.012,
) {
  const start = latLngToVector3(startLat, startLng);
  const end = latLngToVector3(endLat, endLng);
  const angle = start.angleTo(end);
  const axis = new Vector3().crossVectors(start, end);
  if (axis.lengthSq() < 1e-10) axis.crossVectors(start, new Vector3(0, 1, 0));
  if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0);
  axis.normalize();
  const points = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    return (
      start
        .clone()
        .applyAxisAngle(axis, angle * t)
        .multiplyScalar(radius + Math.sin(Math.PI * t) * height)
        // Fan short regional connections sideways for legibility at world scale.
        .addScaledVector(axis, Math.sin(Math.PI * t) * height * 0.5)
    );
  });
  return new CatmullRomCurve3(points);
}
