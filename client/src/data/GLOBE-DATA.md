# SafeLink globe data

`globe-land.json` contains 8,649 [latitude, longitude] samples on land.
It was generated from Natural Earth's 1:110m land polygons, using 30,000
equal-area Fibonacci sphere candidates and a point-in-polygon test (including
holes). Coordinates are rounded to three decimals. This is decorative geography,
not a source for navigation or administrative boundaries.

Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson

Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

`globeNetwork.js` is separately authored, illustrative SafeLink demo data.
Its regional anchor positions do not identify actual office locations, verified
agency partnerships, or live incidents. Arc heights exaggerate separation for
readability on a globe; use the existing Safety Map for local incident geography.

The globe implementation is original project code, using Three.js, React Three
Fiber and Drei. No React Bits Pro code, registry, or license key is used.
