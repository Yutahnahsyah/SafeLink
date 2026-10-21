# Incident municipality reference

`pangasinan-municipalities.geojson.json` contains the 48 Pangasinan city and
municipality features extracted from the **full-resolution**, pinned geoBoundaries
`PHL-ADM3-30758251` dataset (2020 administrative boundaries).

- [Metadata](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/)
- [Pinned full GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PHL/ADM3/geoBoundaries-PHL-ADM3.geojson)
- Sources: NAMRIA, Philippine Statistics Authority, OCHA Philippines.
- License: [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/).
- Retrieved: 2026-10-21. Coordinates: WGS84, longitude then latitude.

Features were selected by the source `shapeID` identifiers already recorded in
the independently sourced 48-locality regression fixture. Every selected feature
retains its original properties and complete geometry. The added `safelinkName`
property maps the source name to an existing SafeLink municipality option. No
coordinates were invented, simplified, rounded, or replaced with rectangles.
Map-view bounds are calculated from those polygons; they are never incident pins.

The original DENR province polygon still decides whether an incident is within
Pangasinan. This separate dataset resolves municipality names, frames the map,
and rejects a municipality label when the pin is demonstrably in another
municipality. Shared municipal edges accept either adjoining municipality.
Different source vintages/coastlines can leave gaps; a gap is not treated as proof
of a conflict or a reason to reject a province-valid incident. It requires manual
address confirmation. These are administrative references, not cadastral surveys.

There are no verified local barangay polygons in this project. The PSGC snapshot
provides canonical names, not geometry. A manually changed barangay therefore
requires explicit pin confirmation; the code never substitutes a guessed centre.
Street/landmark and barangay auto-detection remain dependent on provider coverage.

To refresh: download the full pinned/replacement source, verify source and license,
match all 48 canonical names and source identifiers, retain complete geometries,
record checksums, and run municipal, province-edge, frontend and backend regressions.
Do not silently replace the dataset with its simplified download.

Source SHA-256: `0a125b1716b584ac6728ca0249beb49f29636966b6ecb8974bc0c36db01d4624`.

Extract SHA-256: `391c6cabc28d3532be3ad16ec86df0583dc81f0aa1ff43b9babb9238e27330e0`.
