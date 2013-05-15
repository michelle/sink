// Create an m x n matrix.
Array.matrix = function (m, n, initial) {
  var a, i, j, mat = [];
  for (i = 0; i < m; i += 1) {
    a = [];
    for (j = 0; j < n; j += 1) {
      a[j] = 0;
    }
    mat[i] = a;
  }
  return mat;
};

// Grid utils
function Cell(row, column) {
  this.row = row;
  this.column = column;
};

function copyGrid(source, destination, width, height) {
  for (var h = 0; h < height; h++) {
    for (var w = 0; w < width; w++) {
      destination[h][w] = source[h][w];
    }
  }
};

// Returns the key with the max value in the given dict.
function findMax(dict) {
  var keys = Object.keys(dict);
  var max = 0;
  var maxKey;
  for (var i = 0, ii = keys.length; i < ii; i += 1) {
    var current = dict[keys[i]];
    if (current >= max) {
      max = current;
      maxKey = keys[i];
    }
  }
  return maxKey;
};


$(document).ready(

  function() {

    // DOM elements
    var gridCanvas = document.getElementById("grid");
    var counterSpan = document.getElementById("counter");
    var populationSpan = document.getElementById("population");
    var myPopulationSpan = document.getElementById("score");

    sink('game_of_life_demo', {
          //host: '10.10.65.184',
          collision: function(err) { console.log(err.message); }
        }, function(Life){

      // If variables are not initialized, do so.
      var originator;
      var id;

      // Constants
      var X = 600;
      var Y = 600;
      var CELL_SIZE = 20;

      var WIDTH = X / CELL_SIZE;
      var HEIGHT = Y / CELL_SIZE;
      var DEAD = 0;
      var DELAY = 2000;
      var MINIMUM = 2;
      var MAXIMUM = 3;
      var SPAWN = 3;

      if (Life.id === undefined) {
        Life.id = 1;

        Life.grid = Array.matrix(HEIGHT, WIDTH, 0);
        Life.counter = 0;

        Life.population = 0;
        Life.control = {};
      } else {
        Life.id += 1;
      }

      id = Life.id;
      Life.control[id] = 0;

      // Clean up properly.
      window.onbeforeunload = function() {
        if (originator) {
          Life.originator = false;
        }
        delete Life.control[id];
      }

      // Game of life logic
      // Only the originator performs this step.
      function updateState() {
        var neighbors;
        var nextGenerationGrid = Array.matrix(HEIGHT, WIDTH, 0);
        var population = 0;
        var control = {};

        // Update each cell.
        // TODO: any way to memoize this?
        for (var h = 0; h < HEIGHT; h++) {
          for (var w = 0; w < WIDTH; w++) {
            neighbors = calculateNeighbors(h, w);
            var count = neighbors[0];
            var majority = neighbors[1];
            var current = Life.grid[h][w];

            if (current !== DEAD) {
              if ((count >= MINIMUM) && (count <= MAXIMUM)) {
                nextGenerationGrid[h][w] = current;

                if (!control[current]) {
                  control[current] = 0;
                }
                control[current] += 1;
                population += 1;
              }
            } else if (majority) {
              try {
                nextGenerationGrid[h][w] = parseInt(majority);

                if (!control[majority]) {
                  control[majority] = 0;
                }
                control[majority] += 1;
                population += 1;
              } catch (e) {
                nextGenerationGrid[h][w] = DEAD;
              }
            }
          }
        }

        // Copy into Life grid and update all values.
        copyGrid(nextGenerationGrid, Life.grid, WIDTH, HEIGHT);
        if (Object.keys(control).length > 0) {
          Life.control = control;
        }
        Life.population = population;
        Life.counter++;
      };

      // Game of life logic
      function calculateNeighbors(y, x) {
        var dead = Life.grid[y][x] === DEAD;
        var total = !dead ? -1 : 0;
        var control = {};
        for (var h = -1; h <= 1; h += 1) {
          for (var w = -1; w <= 1; w += 1) {

            var current = Life.grid[(HEIGHT + (y + h)) % HEIGHT]
              [(WIDTH + (x + w)) % WIDTH];
            if (current !== DEAD) {
              total += 1;
              if (!control[current]) {
                control[current] = 0;
              }
              control[current] += 1;
            }
          }
        }

        return [total, total === SPAWN && dead ? findMax(control) : null];
      };



      // render function
      function render() {
        for (var h = 0; h < HEIGHT; h++) {
          for (var w = 0; w < WIDTH; w++) {
            if (Life.grid[h][w] !== DEAD) {
              if (Life.grid[h][w] === id) {
                context.fillStyle = '#D94436';
              } else {
                context.fillStyle = "#444";
              }
            } else if (Life.grid[h][w] === Life.CORPSE) {
              context.fillStyle = "#ccc";
            } else {
              context.fillStyle = "#eee";
            }
            context.fillRect(
              w * CELL_SIZE +1,
              h * CELL_SIZE +1,
              CELL_SIZE -1,
              CELL_SIZE -1);
          }
        }

        // Populate spans.
        counterSpan.innerHTML = Life.counter;
        populationSpan.innerHTML = Life.population;
        if (Life.control[id] && Life.population) {
          myPopulationSpan.innerHTML = Math.round(Life.control[id] * 100 / Life.population) + '%';
        } else {
          myPopulationSpan.innerHTML = '0%';
        }

        // Ensure that there is always one originator to run game logic.
        if (!Life.originator) {
          originator = true;
          Life.originator = true;
          console.log('I\'m the originator!');

          setInterval(updateState, DELAY);
        }

        // Recurse render loop.
        window.requestAnimationFrame(render);
      };

      // initialize canvas
      if (gridCanvas.getContext) {
        var context = gridCanvas.getContext('2d');
        var offset = CELL_SIZE;

        for (var x = 0; x <= X; x += CELL_SIZE) {
          context.moveTo(0.5 + x, 0);
          context.lineTo(0.5 + x, Y);
        }
        for (var y = 0; y <= Y; y += CELL_SIZE) {
          context.moveTo(0, 0.5 + y);
          context.lineTo(X, 0.5 + y);
        }
        context.strokeStyle = "#fff";
        context.stroke();

        function canvasOnClickHandler(event) {
          var cell = getCursorPosition(event);
          var current = Life.grid[cell.row][cell.column];
          // Don't allow user to kill existing ones that are not his own.
          if (current === id) {
            Life.grid[cell.row][cell.column] = DEAD;
          } else if (current === DEAD) {
            Life.grid[cell.row][cell.column] = id;
          }
        };

        function getCursorPosition(event) {
          var x;
          var y;
          if (event.pageX || event.pageY) {
            x = event.pageX;
            y = event.pageY;
          } else {
            x = event.clientX
              + document.body.scrollLeft
              + document.documentElement.scrollLeft;
            y = event.clientY
              + document.body.scrollTop
              + document.documentElement.scrollTop;
          }

          x -= gridCanvas.offsetLeft;
          y -= gridCanvas.offsetTop;

          var cell = new Cell(Math.floor((y - 4) / CELL_SIZE),
            Math.floor((x - 2) / CELL_SIZE));
          return cell;
        };

        gridCanvas.addEventListener("click", canvasOnClickHandler, false);
      } else {
        // Canvas check
        console.log("Canvas failed to load");
      }

      // Start render loop.
      window.requestAnimationFrame(render);

    });
  }
);
