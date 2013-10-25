# openlayers-tilejson

openlayers-tilejson adds support for the
[TileJSON](https://github.com/mapbox/tilejson-spec) specification
to the [OpenLayers](http://openlayers.org) map client.

For extra fun and possibility of future profit, openlayers-tilejson
also supports an
[extension to the TileJSON specification](https://github.com/perliedman/TileJSON/tree/master/2.0.0),
which allows other projections than spherical-mercator. This
extension requires [Proj4js](http://trac.osgeo.org/proj4js/) as extra dependency.

## Example

```javascript
var osmTileJSON = {
    "tilejson": "2.0.0",
    "name": "OpenStreetMap",
    "description": "A free editable map of the whole world.",
    "version": "1.0.0",
    "attribution": "&copy; OpenStreetMap contributors, CC-BY-SA",
    "scheme": "xyz",
    "tiles": [
        "http://a.tile.openstreetmap.org/${z}/${x}/${y}.png",
        "http://b.tile.openstreetmap.org/${z}/${x}/${y}.png",
        "http://c.tile.openstreetmap.org/${z}/${x}/${y}.png"
    ],
    "minzoom": 0,
    "maxzoom": 18,
    "bounds": [ -180, -85, 180, 85 ],
    "center": [ 11.9, 57.7, 8 ]
};

var map = OpenLayers.Layer.TileJSON.createMap('map', osmTileJSON);
```

## Limitations

This is, as everything else, a work in progress. Current known limitations are:

 * No support for UTFGrid interaction. Mostly because Leaflet does not currently support UTFGrid.
 * Only the first tile URL specified is used.
 * Bounds are currently hardcoded.