'use strict';

!function() {
    var semver = (function() {
        var pattern = '\\s*[v=]*\\s*([0-9]+)' +   // major
            '\\.([0-9]+)' +                 // minor
            '\\.([0-9]+)' +                 // patch
            '(-[0-9]+-?)?' +                // build
            '([a-zA-Z-][a-zA-Z0-9-\\.:]*)?'; // tag
        var semverRegEx = new RegExp('^\\s*'+pattern+'\\s*$');

        return {
            parse: function(v) {
                return v.match(semverRegEx);
            }
        };
    })();

    var handlers = {
        name: function(context, tilejson) {
            context.name = tilejson.name;
        },

        tilejson: function(context, tilejson) {
            var v = semver.parse(tilejson);
            if (!v || v[1] !== '2') {
                throw new Error('This parser supports version 2 ' +
                    'of TileJSON. (Provided version: "' +
                    tilejson.tilejson + '"');
            }

            context.validation.version = true;
        },
        minzoom: function(context, minZoom) {
            context.tileLayer.minZoom = minZoom;
        },
        maxzoom: function(context, maxZoom) {
            context.tileLayer.maxZoom = maxZoom;
        },
        center: function(context, center) {
            context.center = new OpenLayers.LonLat(center[0], center[1]);
            context.zoom = center[2];
        },
        attribution: function(context, attribution) {
            context.tileLayer.attribution = attribution;
        },
        projection: function(context, projection) {
            context.crs.projection = projection;
        },
        transform: function(context, t) {
            context.tileLayer.transformation =
                new OpenLayers.Layer.TileJSON.Transformation(t[0], t[1], t[2], t[3]);
        },
        crs: function(context, crs) {
            context.crs.code = crs;
        },
        scales: function(context, s) {
            var r = [];
            for (var i = s.length - 1; i >= 0; i--) {
                r[i] = 1 / s[i];
            }

            context.tileLayer.resolutions = r;
        },
        scheme: function(context, scheme) {
            context.tileLayer.scheme = scheme;
        },
        tilesize: function(context, tileSize) {
            context.tileLayer.tileSize = tileSize;
        },
        tiles: function(context, tileUrls) {
            context.tileUrls = tileUrls;
        }
    };

    function defined(o){
        return (typeof o !== 'undefined' && o !== null);
    }

    function parseTileJSON(tileJSON, options) {
        var context = {
            tileLayer: OpenLayers.Util.applyDefaults({
                minZoom: 0,
                maxZoom: 22,
                maxExtent: [0, 0, 16e9, 16e9]
            }, options.tileLayerConfig || {}),

            map: OpenLayers.Util.applyDefaults({}, options.mapConfig || {}),

            crs: {},

            validation: {
                version: false
            }
        },
        proj;

        for (var key in handlers) {
            if (defined(tileJSON[key])) {
                handlers[key](context, tileJSON[key], tileJSON);
            }
        }

        for (var validationKey in context.validation) {
            if (!context.validation[validationKey]) {
                throw new Error('Missing property "' +
                    validationKey + '".');
            }
        }

        if (defined(context.crs.projection)) {
            Proj4js.defs[context.crs.code] = context.crs.projection;
            proj = new OpenLayers.Projection(context.crs.code);
            context.tileLayer.projection = proj;

            if (defined(context.center)) {
                context.center = context.center.transform(new OpenLayers.Projection('EPSG:4326'), proj);
            }
        } else {
            context.tileLayer.sphericalMercator = true;
        }

        return context;
    }

    function createTileLayer(context) {
        var TileClass = defined(context.crs.projection) ? OpenLayers.Layer.TileJSON : OpenLayers.Layer.XYZ;
        return new TileClass(
                context.name,
                context.tileUrls[0],
                context.tileLayer);
    }

    OpenLayers.Layer.TileJSON = OpenLayers.Class(OpenLayers.Layer.XYZ, {

        getXYZ: function(bounds) {
            var res = this.getServerResolution();
            var t = this.transformation.transform([bounds.left, bounds.top]);
            var x = Math.round(t[0] / (res * this.tileSize.w));
            var y = Math.round(t[1] / (res * this.tileSize.h));
            var z = this.getServerZoom();

            if (this.wrapDateLine) {
                var limit = Math.pow(2, z);
                x = ((x % limit) + limit) % limit;
            }

            return {'x': x, 'y': y, 'z': z};
        },
    });

    OpenLayers.Layer.TileJSON.Transformation = OpenLayers.Class({
        initialize: function(a, b, c, d) {
            this.a = a;
            this.b = b;
            this.c = c;
            this.d = d;
        },

        transform: function(p) {
            return [
                this.a * p[0] + this.b,
                this.c * p[1] + this.d
            ];
        }
    });

    OpenLayers.Layer.TileJSON.prototype.transformation = new OpenLayers.Layer.TileJSON.Transformation(1, 0, -1, 0);

    // Add static methods
    OpenLayers.Util.applyDefaults(OpenLayers.Layer.TileJSON, {
        createMapConfig: function(tileJSON, cfg) {
            return parseTileJSON(tileJSON, {mapConfig: cfg}).map;
        },
        createTileLayerConfig: function(tileJSON, cfg) {
            return parseTileJSON(tileJSON, {tileLayerConfig: cfg}).tileLayer;
        },
        createTileLayer: function(tileJSON, options) {
            var context = parseTileJSON(tileJSON, options || {});
            return createTileLayer(context);
        },
        createMap: function(id, tileJSON, options) {
            options = options || {};
            var context = parseTileJSON(tileJSON, options);
            context.map.layers = [createTileLayer(context)];
            var map = new OpenLayers.Map(id, context.map);

            if (defined(context.center) && defined(context.zoom) &&
                (!defined(options.setCenter) || options.setCenter)) {
                map.setCenter(context.center, context.zoom);
            }

            return map;
        }
    });
}();
