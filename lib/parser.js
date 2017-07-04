var flatten = require('flat')
var log = require("./logger.js")("parser");
// ---

const mapFieldsTemp = (obj, parentKey) => {
  if (Array.isArray(obj)) {
    return flattenArray(obj, parentKey)
  }else if (typeof(obj) == "object") {
    return flattenFields(obj, parentKey)
  }
  return obj
}
const flattenArray = (obj, parentKey, fullKey) => {
  var flatArr = obj[parentKey].map( (elem) => {
    var newObj = {}
    Object.keys(elem).forEach( (key) => {
      const newKey = fullKey + "." + key
      newObj[newKey] = mapFieldsTemp(elem[key], newKey)
    })
    return newObj
  })

  return flatArr
}
const flattenFields = (obj, parentKey) => {
  var objBase = {}
  var parsedArrays = { maxArrayLength: 0, arrays: [] }

  Object.keys(obj).forEach( (key) => {

    const fullKey = parentKey.length > 0 ? parentKey + "." + key : key

    if (Array.isArray(obj[key])) { //the attr is an Array
      if (obj[key].length == 0 || typeof(obj[key][0]) != "object") { //the attr is an array of primitives
        objBase[fullKey] = obj[key]

      }else{ //the attr is an array of objects|arrays
        const flattedArray = flattenArray(obj, key, fullKey)
        parsedArrays.arrays.push(flattedArray);
        if (flattedArray.length > parsedArrays.maxArrayLength) {
          parsedArrays.maxArrayLength = flattedArray.length
        }
      }
    }else if (typeof(obj[key]) === "object") { //the attr is an object
      var flattedTemp = flattenFields(obj[key], fullKey)
      if (Array.isArray(flattedTemp)) {
        parsedArrays.arrays.push(flattedTemp);
        if (flattedTemp.length > parsedArrays.maxArrayLength) {
          parsedArrays.maxArrayLength = flattedTemp.length
        }
      }else{
        objBase = Object.assign({}, objBase, flattedTemp)
      }
    }else{
      objBase[fullKey] = obj[key]
    }

  })

  var retArray = []
  for (var j = 0; j < parsedArrays.maxArrayLength; j++) {
    var arraysMerged = {}
    for (var i = 0; i < parsedArrays.arrays.length; i++) { //normalize all arrays sizes, using blank string
      if (typeof(parsedArrays.arrays[i][j]) == "undefined") {
        parsedArrays.arrays[i][j] = ""
      }
      arraysMerged = Object.assign(arraysMerged, parsedArrays.arrays[i][j])
    }
    retArray.push(Object.assign({}, objBase, arraysMerged))
  }


  if (retArray.length > 0) {
    return retArray
  }

  return flatten(objBase, {safe: true})
}

class MessageParser {

    constructor (settings) {
        this.settings = {
            mode: settings.mode || "auto",
            static_filed: settings.static_filed || "payload",
            text_filed: settings.text_filed || "text",
            numeric_filed: settings.numeric_filed || "value",
            numeric_parser_mode: settings.numeric_parser_mode || "tolerant"
        };

        this.initParser();
    }

    initParser () {
        switch (this.settings.numeric_parser_mode){

            case "strict":
                var regx = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;
                this._numericParser = (value) => {
                    if (regx.test(value)) {
                        return parseFloat(value);
                    }
                    return Number.NaN;
                }
                break;

            case "tolerant":
                this._numericParser = (value) => parseFloat(value);
                break;

            case "eager":
                var regx = /([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/;
                this._numericParser = (value) => {
                    var m = regx.exec(value);
                    if (m != null) {
                        return parseFloat(m[1]);
                    }
                    return Number.NaN;
                }
                break;

            default:
                throw "Unknown parser '" + this.settings.numeric_parser_mode + "'";
        }
    }

    parse (id, topic, payload) {

        var t = this.parseTopic(id, topic);
        var v = this.parsePayload(id, payload);

        if (t == null) {
            return null;
        }

        return {
            name: t.measurement,
            tags: t.tags,
            values: v
        }
    }

    parseTopic (id, topic) {

        topic = topic.trim();

        if (topic.charAt(0) == "/") {
            topic = topic.substr(1);
        }

        if (topic.charAt(topic.length-1) == "/") {
            topic = topic.substr(0, topic.length - 1);
        }

        if (topic == "") {
            return null;
        }

        var parts = topic.split("/");

        // measurement
        var measurement = parts[0];

        // tags
        var tags = {
            topic: topic
        };

        for(var i = 0; i < parts.length; i++) {
            tags["tp" + i] = parts[i];
        }

        // result
        var m = {
            measurement: measurement,
            tags: tags
        };

        return m;
    };

    parsePayload (id, payload) {

        var result = {};

        if (this.settings.mode == "static") {

            result[this.settings.static_filed] = payload;

        } else if (this.settings.mode == "mapFields") {

          log.trace("Message #%s payload sould be JSON", id);
          return flattenFields(JSON.parse(payload), '')

        } else {

            var num = this._numericParser(payload.trim());

            if (!isNaN(num)) {

                log.trace("Message #%s payload is number", id);
                result[this.settings.numeric_filed] = num;
            } else {
                log.trace("Message #%s payload is text", id);

                result[this.settings.text_filed] = payload;
            }
        }

        return result;
    };

}

// ---

exports.MessageParser = MessageParser;
