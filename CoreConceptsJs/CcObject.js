/**
 * JavaScript implementation of the core concept 'object'
 * version: 0.1.0
 * (c) Liangcun Jiang
 * latest change: Feb 17, 2017.
 */
define(["dojo/_base/declare",
    "dojo/Deferred",
    "esri/tasks/query",
    "esri/layers/FeatureLayer",
    "esri/tasks/BufferParameters",
    "esri/tasks/RelationParameters",
    "esri/tasks/GeometryService"
], function (declare, Deferred, Query, FeatureLayer, BufferParameters, RelationParameters, GeometryService) {
    return declare(null, {
        /**
         * CcObject constructor: Constructs an object instance from either a Map Service or Feature Service
         * @param url: URL to the ArcGIS Server REST resource that represents an feature service.
         */
        constructor: function (url) {
            if (url === null || url === "" || url === undefined) {
                alert("Please enter a valid URL for the field data");
                return;
            }
            var featureLayer = new FeatureLayer(url);
            this.layer = featureLayer; //return featureLayer instead?
        },

        /**
         * CcObject function: gets CcObject's bounds in form of a bounding box(xmin, ymin, xmax, ymax)
         * Return type: Deferred
         * Uses the callback function to receive the object's extent.
         */
        bounds: function () {
            var query = new Query();
            query.where = "1=1"; // Query for all records
            query.outFields = ["*"];
            query.returnGeometry = true;
            var process = this.layer.queryExtent(query);
            return process.then(function (extent) {
                return extent;
            });
        },

        /**
         * CcObject function: gets CcObject's geometry
         * Return type: Deferred
         * Uses the callback function to receive the object's geometry (an array of Geometry).
         */
        getGeometry: function () {
            var query = new Query();
            query.where = "1=1"; // Query for all records
            query.outFields = ["*"];
            query.returnGeometry = true;
            var process = this.layer.queryFeatures(query);
            //function _getGeometry(featureSet){
            //    var geometry = [];
            //    for (var i = 0; i < featureSet.features.length; i++  ) {
            //        geometry.push(featureSet.features[i].geometry);
            //    }
            //    var deferred = new Deferred();
            //    deferred.resolve(geometry);
            //    return deferred.promise;
            //}
            return process.then(function (featureSet) {
                var geometryArray = [];
                for (var i = 0; i < featureSet.features.length; i++) {
                    geometryArray.push(featureSet.features[i].geometry);
                }
                return geometryArray;
            });
        },

        /**
         * CcObject function: Creates buffer polygons at a specified distance around the given object.
         * @param distance: the distance the input object are buffered.
         * @param unitType: the unit for calculating each buffer distance.(case insensitive: kilometer = Kilometer)
         *                 Units can be singular or plural forms: e.g. Foot = feet
         * Return type: Deferred
         * Uses the callback function to receive an array of Geometry that contains the buffer polygons.
         */
        buffer: function (distance, unitType) {
            //This service provided by ESRI is for development and testing purposes only.
            //var gsUrl = "https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer";
            var gsUrl = "https://ags-raid.geog.ucsb.edu:6443/arcgis/rest/services/Utilities/Geometry/GeometryServer";
            var gs = new GeometryService(gsUrl);

            //Defines valid unit types here
            var bufferUnits = {
                "METER": GeometryService.UNIT_METER,
                "METERS": GeometryService.UNIT_METER,
                "KILOMETER": GeometryService.UNIT_KILOMETER,
                "KILOMETERS": GeometryService.UNIT_KILOMETER,
                "FOOT": GeometryService.UNIT_FOOT, //International foot (0.3048 meters)
                "FEET": GeometryService.UNIT_FOOT,
                "MILE": GeometryService.UNIT_STATUTE_MILE, //Miles (5,280 feet, 1,760 yards, or exactly 1,609.344 meters)
                "MILES": GeometryService.UNIT_STATUTE_MILE,
                "NAUTICAL_MILE": GeometryService.UNIT_NAUTICAL_MILE, //Nautical Miles (1,852 meters)
                "NAUTICAL_MILES": GeometryService.UNIT_NAUTICAL_MILE,
                "DEGREE": GeometryService.UNIT_DEGREE,
                "DEGREES": GeometryService.UNIT_DEGREE
            };

            //setup the buffer parameters
            var params = new BufferParameters();
            params.distances = [distance];
            params.unit = bufferUnits[unitType.toUpperCase()];
            //If true, all geometries buffered at a given distance are unioned into
            //a single (possibly multipart) polygon, and the unioned geometry is placed in the output array.
            params.unionResults = true;

            //Get the object geometries and do the buffer
            return this.geometry().then(function (geometries) {
                //The Geometry Service allows a maxBufferCount of 12500.
                // The maxBufferCount property establishes the maximum number of features that can be buffered
                if (geometries.length <= 12500) {
                    params.geometries = geometries;
                    //do the buffer
                    console.log("Doing the buffer...");
                    //buffer function returns a "<Polygon[]> geometries" Array[1]
                    return gs.buffer(params);
                } else {
                    //if the number of features exceeds the maxBufferCount, then executes buffer operation in two parts.
                    //Needs to extend this code snippet if the number of features > 250000.
                    params.geometries = geometries.slice(0, 12500)
                    //do the buffer
                    console.log("Buffering part 1...");
                    return gs.buffer(params).then(function (bufferedGeometries1) {
                        console.log("Buffering part 2...");
                        params.geometries = geometries.slice(12500);
                        var gs2 = new GeometryService("https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer");
                        return gs2.buffer(params).then(function (bufferedGeometries2) {
                            //console.log([bufferedGeometries1, bufferedGeometries2]);
                            //console.log(bufferedGeometries1.concat(bufferedGeometries2));
                            var gs3 = new GeometryService(gsUrl);
                            //constructs the set-theoretic union of the two buffered geometries
                            console.log("Unifying two parts...");
                            //union function returns a "<Geometry> geometry" Object, then converts it to an Array[1]
                            return gs3.union(bufferedGeometries1.concat(bufferedGeometries2)).then(function (geoUnion) {
                                return [geoUnion];
                            });
                        });
                    });
                }
            });
        },

        /**
         * CcObject function: returns true if self and obj are in a relationship of type relType.
         * @param obj:
         * @param relType: The spatial relationship to be tested between the two CcObject.
         * Return type: Deferred
         * Uses the callback function to receive the result.
         */
        relation: function (obj, relType) {
            var gsUrl = "https://ags-raid.geog.ucsb.edu:6443/arcgis/rest/services/Utilities/Geometry/GeometryServer";
            var gs = new GeometryService(gsUrl);
            var relationParams = new RelationParameters();
            relationParams.geometries1 = null;
            relationParams.geometries2 = null;
            relationParams.relation = RelationParameters.SPATIAL_REL_WITHIN;
            return gs.relation(relationParams).then(function (relatedResults) {
                return relatedResults ? true : false;
            });
        },

        /**
         * CcObject function: returns value of property in obj
         * @param prop: the property name
         * Return type: Deferred
         * Uses the callback function to receive the result.
         */
        property: function (prop) {

        }
    });
});