(function() {
    'use strict';
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
                maxExtent: new OpenLayers.Bounds(0, 0, 16e9, 16e9)
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

    // Backport some classes and methods for OpenLayers version < 2.8.
    // Got to love software using reeeeeaaaally old versions.
    if (typeof(OpenLayers.Util.isArray) === 'undefined') {
        /**
         * Function: isArray
         * Tests that the provided object is an array.
         * This test handles the cross-IFRAME case not caught
         * by "a instanceof Array" and should be used instead.
         *
         * Parameters:
         * a - {Object} the object test.
         *
         * Returns:
         * {Boolean} true if the object is an array.
         */
        OpenLayers.Util.isArray = function(a) {
            return (Object.prototype.toString.call(a) === '[object Array]');
        };
    }

    if (typeof(OpenLayers.Layer.XYZ) === 'undefined') {
        /* Copyright (c) 2006-2013 by OpenLayers Contributors (see authors.txt for
         * full list of contributors). Published under the 2-clause BSD license.
         * See license.txt in the OpenLayers distribution or repository for the
         * full text of the license. */

        /**
         * @requires OpenLayers/Layer/Grid.js
         */

        /**
         * Class: OpenLayers.Layer.XYZ
         * The XYZ class is designed to make it easier for people who have tiles
         * arranged by a standard XYZ grid.
         *
         * Inherits from:
         *  - <OpenLayers.Layer.Grid>
         */
        OpenLayers.Layer.XYZ = OpenLayers.Class(OpenLayers.Layer.Grid, {

            /**
             * APIProperty: isBaseLayer
             * Default is true, as this is designed to be a base tile source.
             */
            isBaseLayer: true,

            /**
             * APIProperty: sphericalMercator
             * Whether the tile extents should be set to the defaults for
             *    spherical mercator. Useful for things like OpenStreetMap.
             *    Default is false, except for the OSM subclass.
             */
            sphericalMercator: false,

            /**
             * APIProperty: zoomOffset
             * {Number} If your cache has more zoom levels than you want to provide
             *     access to with this layer, supply a zoomOffset.  This zoom offset
             *     is added to the current map zoom level to determine the level
             *     for a requested tile.  For example, if you supply a zoomOffset
             *     of 3, when the map is at the zoom 0, tiles will be requested from
             *     level 3 of your cache.  Default is 0 (assumes cache level and map
             *     zoom are equivalent).  Using <zoomOffset> is an alternative to
             *     setting <serverResolutions> if you only want to expose a subset
             *     of the server resolutions.
             */
            zoomOffset: 0,

            /**
             * APIProperty: serverResolutions
             * {Array} A list of all resolutions available on the server.  Only set this
             *     property if the map resolutions differ from the server. This
             *     property serves two purposes. (a) <serverResolutions> can include
             *     resolutions that the server supports and that you don't want to
             *     provide with this layer; you can also look at <zoomOffset>, which is
             *     an alternative to <serverResolutions> for that specific purpose.
             *     (b) The map can work with resolutions that aren't supported by
             *     the server, i.e. that aren't in <serverResolutions>. When the
             *     map is displayed in such a resolution data for the closest
             *     server-supported resolution is loaded and the layer div is
             *     stretched as necessary.
             */
            serverResolutions: null,

            tileClass: OpenLayers.Tile.Image,

            /**
             * Constructor: OpenLayers.Layer.XYZ
             *
             * Parameters:
             * name - {String}
             * url - {String}
             * options - {Object} Hashtable of extra options to tag onto the layer
             */
            initialize: function(name, url, options) {
                if (options && options.sphericalMercator || this.sphericalMercator) {
                    options = OpenLayers.Util.extend({
                        projection: "EPSG:900913",
                        numZoomLevels: 19
                    }, options);
                }
                OpenLayers.Layer.Grid.prototype.initialize.apply(this, [
                    name || this.name, url || this.url, {}, options
                ]);
            },

            /**
             * APIMethod: clone
             * Create a clone of this layer
             *
             * Parameters:
             * obj - {Object} Is this ever used?
             *
             * Returns:
             * {<OpenLayers.Layer.XYZ>} An exact clone of this OpenLayers.Layer.XYZ
             */
            clone: function (obj) {

                if (obj == null) {
                    obj = new OpenLayers.Layer.XYZ(this.name,
                                                    this.url,
                                                    this.getOptions());
                }

                //get all additions from superclasses
                obj = OpenLayers.Layer.Grid.prototype.clone.apply(this, [obj]);

                return obj;
            },

            /**
             * Method: getURL
             *
             * Parameters:
             * bounds - {<OpenLayers.Bounds>}
             *
             * Returns:
             * {String} A string with the layer's url and parameters and also the
             *          passed-in bounds and appropriate tile size specified as
             *          parameters
             */
            getURL: function (bounds) {
                var xyz = this.getXYZ(bounds);
                var url = this.url;
                if (OpenLayers.Util.isArray(url)) {
                    var s = '' + xyz.x + xyz.y + xyz.z;
                    url = this.selectUrl(s, url);
                }

                return OpenLayers.String.format(url, xyz);
            },

            /**
             * Method: getXYZ
             * Calculates x, y and z for the given bounds.
             *
             * Parameters:
             * bounds - {<OpenLayers.Bounds>}
             *
             * Returns:
             * {Object} - an object with x, y and z properties.
             */
            getXYZ: function(bounds) {
                var res = this.getServerResolution();
                var x = Math.round((bounds.left - this.maxExtent.left) /
                    (res * this.tileSize.w));
                var y = Math.round((this.maxExtent.top - bounds.top) /
                    (res * this.tileSize.h));
                var z = this.getServerZoom();

                if (this.wrapDateLine) {
                    var limit = Math.pow(2, z);
                    x = ((x % limit) + limit) % limit;
                }

                return {'x': x, 'y': y, 'z': z};
            },

            /* APIMethod: setMap
             * When the layer is added to a map, then we can fetch our origin
             *    (if we don't have one.)
             *
             * Parameters:
             * map - {<OpenLayers.Map>}
             */
            setMap: function(map) {
                OpenLayers.Layer.Grid.prototype.setMap.apply(this, arguments);
                if (!this.tileOrigin) {
                    this.tileOrigin = new OpenLayers.LonLat(this.maxExtent.left,
                                                        this.maxExtent.bottom);
                }
            },

            addTile: function(bounds, position) {
                var tile = new this.tileClass(
                    this, position, bounds, null, this.tileSize, this.tileOptions
                );
                this.events.triggerEvent("addtile", {tile: tile});
                return tile;
            },

            /**
             * Method: getServerResolution
             * Return the closest server-supported resolution.
             *
             * Parameters:
             * resolution - {Number} The base resolution. If undefined the
             *     map resolution is used.
             *
             * Returns:
             * {Number} The closest server resolution value.
             */
            getServerResolution: function(resolution) {
                var distance = Number.POSITIVE_INFINITY;
                resolution = resolution || this.map.getResolution();
                if(this.serverResolutions &&
                   OpenLayers.Util.indexOf(this.serverResolutions, resolution) === -1) {
                    var i, newDistance, newResolution, serverResolution;
                    for(i=this.serverResolutions.length-1; i>= 0; i--) {
                        newResolution = this.serverResolutions[i];
                        newDistance = Math.abs(newResolution - resolution);
                        if (newDistance > distance) {
                            break;
                        }
                        distance = newDistance;
                        serverResolution = newResolution;
                    }
                    resolution = serverResolution;
                }
                return resolution;
            },

            /**
             * Method: getServerZoom
             * Return the zoom value corresponding to the best matching server
             * resolution, taking into account <serverResolutions> and <zoomOffset>.
             *
             * Returns:
             * {Number} The closest server supported zoom. This is not the map zoom
             *     level, but an index of the server's resolutions array.
             */
            getServerZoom: function() {
                var resolution = this.getServerResolution();
                return this.serverResolutions ?
                    OpenLayers.Util.indexOf(this.serverResolutions, resolution) :
                    this.map.getZoomForResolution(resolution) + (this.zoomOffset || 0);
            },

            CLASS_NAME: "OpenLayers.Layer.XYZ"
        });
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
            var map = new OpenLayers.Map(id, context.map);
            context.tileLayer.isBaseLayer = true;
            map.addLayer(createTileLayer(context));

            if (defined(context.center) && defined(context.zoom) &&
                (!defined(options.setCenter) || options.setCenter)) {
                map.setCenter(context.center, context.zoom);
            }

            return map;
        }
    });
})();
