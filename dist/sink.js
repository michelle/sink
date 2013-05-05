/*! sink.js build:0.0.0, development. Copyright(c) 2013 Eric Zhang, Michelle Bu, Rolland Wu MIT Licensed */
(function(exports){
util = {
  getChromeProxyFunctions: function(obj) {
    return {
      set: function(receiver, name, pd) {
        obj[name] = pd;
      },

      // Fundamental traps.
      getOwnPropertyDescriptor: function(name) {
        var desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc !== undefined) { desc.configurable = true; }
        return desc;
      },

      getPropertyDescriptor: function(name) {
        var desc = Object.getPropertyDescriptor(obj, name);
        if (desc !== undefined) { desc.configurable = true; }
        return desc;
      },

      getOwnPropertyNames: function() {
        return Object.getOwnPropertyNames(obj);
      },

      getPropertyNames: function(name) {
        return Object.getPropertyNames(obj);
      },

      defineProperty: function(name, pd) {
        Object.defineProperty(obj, name, pd);
      },

      delete: function(name) {
        return delete obj.name;
      },

      fix: function() {
        if (Object.isFrozen(obj)) {
          var result = {};
          var names = Object.getOwnPropertyNames(obj);
          for (var i = 0, ii = names.length; i < ii; i += 1) {
            var name = names[i];
            result[name] = Object.getOwnPropertyDescriptor(obj, name);
          }
          return result;
        }
        return undefined;
      }
    };
  }
};

function sink(namespace, cb) {

  var o = {};

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o));

  cb(p);

};

exports.sink = sink;

})(this);
