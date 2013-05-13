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
    var gridCanvas = document.getElementById("grid");
    var counterSpan = document.getElementById("counter");
    var populationSpan = document.getElementById("population");
    var myPopulationSpan = document.getElementById("score");

    sink('game_of_life_demo', function(Life){

      // If variables are not initialized, do so.
      var originator;
      var id;
      if (Life.CELL_SIZE === undefined) {
        Life.CELL_SIZE = 20;
        Life.X = 600;
        Life.Y = 600;

        Life.WIDTH = Life.X / Life.CELL_SIZE;
        Life.HEIGHT = Life.Y / Life.CELL_SIZE;

        Life.DEAD = 0;

        // TODO: will it ever be stopped?
        Life.STOPPED = 0;
        Life.RUNNING = 1;
        Life.DELAY = 2000;

        Life.minimum = 2;
        Life.maximum = 3;
        Life.spawn = 3;
        Life.id = 0;

        Life.state = Life.RUNNING;
        Life.grid = Array.matrix(Life.HEIGHT, Life.WIDTH, 0);
        Life.counter = 0;

        Life.population = 0;
        Life.control = {};
      }

      Life.id += 1;

      id = Life.id;
      Life.control[id] = 0;

      // Game of life logic
      function updateState() {
        var neighbors;
        var nextGenerationGrid = Array.matrix(Life.HEIGHT, Life.WIDTH, 0);
        var population = 0;
        var control = {};

        for (var h = 0; h < Life.HEIGHT; h++) {
          for (var w = 0; w < Life.WIDTH; w++) {
            neighbors = calculateNeighbors(h, w);
            var count = neighbors[0];
            var majority = neighbors[1];
            var current = Life.grid[h][w];

            if (current !== Life.DEAD) {
              if ((count >= Life.minimum) && (count <= Life.maximum)) {
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
                nextGenerationGrid[h][w] = Life.DEAD;
              }
            }
          }
        }
        copyGrid(nextGenerationGrid, Life.grid);
        Life.control = control;
        Life.population = population;
        Life.counter++;
      };

      function calculateNeighbors(y, x) {
        var dead = Life.grid[y][x] === Life.DEAD;
        var total = !dead ? -1 : 0;
        var control = {};
        for (var h = -1; h <= 1; h += 1) {
          for (var w = -1; w <= 1; w += 1) {

            var current = Life.grid[(Life.HEIGHT + (y + h)) % Life.HEIGHT]
              [(Life.WIDTH + (x + w)) % Life.WIDTH];
            if (current !== Life.DEAD) {
              total += 1;
              if (!control[current]) {
                control[current] = 0;
              }
              control[current] += 1;
            }
          }
        }

        return [total, total === Life.spawn && dead ? findMax(control) : null];
      };


      function copyGrid(source, destination) {
        for (var h = 0; h < Life.HEIGHT; h++) {
          for (var w = 0; w < Life.WIDTH; w++) {
            destination[h][w] = source[h][w];
          }
        }
      };


      // render function
      function render() {
        for (var h = 0; h < Life.HEIGHT; h++) {
          for (var w = 0; w < Life.WIDTH; w++) {
            if (Life.grid[h][w] !== Life.DEAD) {
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
              w * Life.CELL_SIZE +1,
              h * Life.CELL_SIZE +1,
              Life.CELL_SIZE -1,
              Life.CELL_SIZE -1);
          }
        }
        counterSpan.innerHTML = Life.counter;
        populationSpan.innerHTML = Life.population;
        if (Life.control[id] && Life.population) {
          myPopulationSpan.innerHTML = Math.round(Life.control[id] * 100 / Life.population) + '%';
        } else {
          myPopulationSpan.innerHTML = '0%';
        }

        if (!Life.originator) {
          originator = true;
          Life.originator = true;

          setInterval(updateState, Life.DELAY);

          window.onbeforeunload = function() {
            Life.originator = false;
          }
        }

        // Recurse render loop.
        window.webkitRequestAnimationFrame(render);
      };

      // initialize canvas
      if (gridCanvas.getContext) {
        var context = gridCanvas.getContext('2d');
        var offset = Life.CELL_SIZE;

        for (var x = 0; x <= Life.X; x += Life.CELL_SIZE) {
          context.moveTo(0.5 + x, 0);
          context.lineTo(0.5 + x, Life.Y);
        }
        for (var y = 0; y <= Life.Y; y += Life.CELL_SIZE) {
          context.moveTo(0, 0.5 + y);
          context.lineTo(Life.X, 0.5 + y);
        }
        context.strokeStyle = "#fff";
        context.stroke();

        function canvasOnClickHandler(event) {
          var cell = getCursorPosition(event);
          var current = Life.grid[cell.row][cell.column];
          // Don't allow user to kill existing ones that are not his own.
          if (current === id) {
            Life.grid[cell.row][cell.column] = Life.DEAD;
          } else if (current === Life.DEAD) {
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

          var cell = new Cell(Math.floor((y - 4) / Life.CELL_SIZE),
            Math.floor((x - 2) / Life.CELL_SIZE));
          return cell;
        };

        gridCanvas.addEventListener("click", canvasOnClickHandler, false);
      } else {
        // Canvas check
        console.log("Canvas failed to load");
      }

      // Start render loop.
      window.webkitRequestAnimationFrame(render);
    });
  }
);
