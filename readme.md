# CS164 Final Project -- Sink
## Team Kitchen

Our project seeks to implement a small language in Javascript. Using what we
learned in CS164, we are adding a library of javascript functions that melds
seamlessly with the parent language of Javascript. In order to allow users
shared objects, we provide an `sink` function that executes does all the work of
synchronization under the hood so the users can access a simple API and be able
to work with shared objects.

***Please note that the current implementation is limited to Chrome. Go to
`chrome://flags` and enable 'Experimental Javascript.'***

## Usage

```javascript
sink('mybathroom', function(s, err) {

  // s is your new synced object.
  s.toilet = {};

  // References are maintained.
  var loo = s.toilet;

  // Arrays are also synced.
  loo.contents = [];
  loo.contents.push('leftovers');

  setInterval(checkToilet, 100);

  // Synced objects will automatically be updated.
  function checkToilet() {
    if (loo.indexOf('poo') !== -1) {
      // flush.
      loo.push('more water');
    }
  };

});
```

## API

`sink(namespace, options, function(synced, err) { });`:

* `namespace`: All Sink objects in the same namespace are synced.
* `options`:
** `force`: If true, will ignore collisions and always update the server and all other clients. Defaults to false.
** `collision (: function(err) {} )`: A callback that will be called if a collision is detected on a change to the synced object.
** `host`: Host name of your Sink server. Defaults to localhost. If the cloud server is used, the `namespace` passed in should be an API key.
** `port`: Port # of your Sink server. Defaults to 8080.
** `debug`: If true, will display Sink debug messages. Defaults to false.
* `synced`: The synced object.
* `err`: Error message, if `synced` is `null`.

## There's even a 164 version!

![164 implementation](http://i.imgur.com/50R9aln.png)
