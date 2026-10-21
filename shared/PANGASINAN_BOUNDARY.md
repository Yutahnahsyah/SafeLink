# Incident reporting province boundary

`pangasinan-province.geojson.json` is the unmodified GeoJSON response downloaded
2026-10-21 from the Philippine DENR Forest Management Bureau's published
[Provincial Boundary service](https://fmbfsd.denr.gov.ph/server/rest/services/Hosted/Provincial_Boundary/FeatureServer/0).

Query: `/query?where=province%20%3D%20%27PANGASINAN%27&outFields=*&returnGeometry=true&outSR=4326&f=geojson`

- Feature: `objectid=66`, `province=PANGASINAN`, source province code `105500000`.
- CRS: WGS84 / EPSG:4326, coordinate order longitude, latitude.
- Full returned MultiPolygon: 106 polygon parts, 107 rings, 4,429 coordinate pairs
  including ring closure. Islands and the interior hole are retained.
- No simplification, precision reduction, bounding-box replacement, or invented
  vertices. No `maxAllowableOffset` or `geometryPrecision` query parameters.
- Raw response SHA-256: `c42fa30cb2e76dc2a3ed7f27e6558c2958413b0685712a953e9d2ec525bfd9a8`.
- The service leaves description and copyright text blank and does not specify a
  survey vintage. This is a published administrative boundary, not a claim of
  cadastral precision or a newly surveyed legal boundary.

`incidentProvince.mjs` is used by manual incident pin selection, report-step
validation, final frontend submission and backend creation validation. Bounds
only skip irrelevant polygons; polygon membership decides acceptance. Outer and
hole edges are included; hole interiors are excluded. A numerical tolerance of
1e-10 degrees is not a geographic buffer. Manual pins retain full precision so a
valid edge coordinate does not move outside when saved. Address-provider labels
cannot override this geometry for manual pins, and coordinates are not restricted
to individual municipal polygons.

Manual pin selection and incident submission use this province geometry.
Current Location acquisition and address lookup remain unchanged in this change.
The separate community/dashboard boundary utility remains unchanged. Submission
validates every coordinate regardless of origin.
The existing Leaflet picker has no marker dragging or coordinate-entry controls.

## Boundary validation and independent reference

The province geometry was checked against independent interior samples from all
48 existing cities and municipalities, including all four cities and Anda.
Source vertices, edge midpoints, island parts, hole edges and points immediately
across boundary rings were also verified. These QA samples are not runtime data;
only the DENR snapshot above is used for province acceptance.

Independent reference: geoBoundaries `PHL-ADM3-30758251`, boundary year 2020;
underlying sources NAMRIA, PSA and OCHA Philippines; license CC BY 3.0 IGO.

- [ADM3 metadata](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/)
- [Pinned ADM3 reference](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PHL/ADM3/geoBoundaries-PHL-ADM3_simplified.geojson)
- [Pinned ADM2 reference](https://github.com/wmgeolab/geoBoundaries/raw/41af8f1/releaseData/gbOpen/PHL/ADM2/geoBoundaries-PHL-ADM2_simplified.geojson)

When refreshing the snapshot, retain the unmodified response and its checksum,
confirm that islands and holes remain present, and recheck all locality coverage
and edge behavior before replacing production data. Simplified reference data
must not replace the runtime geometry merely to reduce file size.

The server's asynchronous custom validation follows
[express-validator 7](https://express-validator.github.io/docs/guides/customizing/);
the shared JSON import follows [Node JSON modules](https://nodejs.org/api/esm.html#json-modules).
