function sink(namespace, cb) {

  var o = {};

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o));

  cb(p);

};

exports.sink = sink;
