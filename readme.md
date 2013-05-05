# CS164 Final Project -- Sink
## Team Kitchen

Our project seeks to implement a small language in Javascript. Using what we
learned in CS164, we are adding a library of javascript functions that melds
seamlessly with the parent language of Javascript. In order to allow users
shared objects, we provide an `sink` function that executes does all the work of
synchronization under the hood so the users can access a simple API and be able
to work with shared objects.

## API

It's simple:

```javascript
sink('mynamespace', function(s) {

  // s is your new synced object.
  s.toilet = {};

  // References are maintained.
  var loo = s.toilet;

  // Arrays are also synced.
  loo.contents = [];
  loo.contents.push('leftovers');

  setInterval(checkToilet, 100);

  // Synced will automatically be updated.
  function checkToilet() {
    if (loo.indexOf('poo') !== -1) {
      // flush.
      loo.push('more water');
    }
  };

});
```
