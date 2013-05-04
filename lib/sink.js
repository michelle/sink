function sink(namespace, cb) {

  var o = {};
  var a = {}

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o, a));

  cb(p);

};

exports.sink = sink;
