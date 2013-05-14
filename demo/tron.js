$(document).ready(function(){
	//Canvas stuff
	var canvas = $("#canvas")[0];
	var ctx = canvas.getContext("2d");
	var w = $("#canvas").width();
	var h = $("#canvas").height();
	
	//Lets save the cell width in a variable for easy control
  var my_color;
	var cw = 10;
	var direction;
	var score;
  var visited = {};
  var my_position = "0,0"
	
	//Lets create the snake now
	var snake_array; //an array of cells to make up the snake
	
	function init()
	{
		direction = "right"; //default direction
		//finally lets display the score
		score = 0;
		my_color = "blue"
    visited = {}
    my_position = "0,0"
    
		//Lets move the snake now using a timer which will trigger the paint function
		//every 60ms
		if(typeof game_loop != "undefined") clearInterval(game_loop);
		game_loop = setInterval(paint, 100);
	}
	init();
	
	//Lets paint the snake now
	function paint()
	{
		//To avoid the snake trail we need to paint the BG on every frame
		//Lets paint the canvas now
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = "black";
		ctx.strokeRect(0, 0, w, h);
		
		//The movement code for the snake to come here.
		//The logic is simple
    var pos_array = my_position.split(",")
		var nx = parseInt(pos_array[0])
		var ny = parseInt(pos_array[1])
		//These were the position of the head cell.
		//We will increment it to get the new head position
		//Lets add proper direction based movement now
		if(direction == "right") nx++;
		else if(direction == "left") nx--;
		else if(direction == "up") ny--;
		else if(direction == "down") ny++;
		
    //update my position
    my_position = nx + "," + ny;
    
		//Lets add the game over clauses now
		//This will restart the game if the snake hits the wall
		//Lets add the code for body collision
		//Now if the head of the snake bumps into its body, the game will restart
    //FIXME: Add clause to check for collision
		if(nx == -1 || nx == w/cw || ny == -1 || ny == h/cw || visited[my_position])
		{
			//restart game
      console.log("crashed")
			init();
			//Lets organize the code a bit now.
			return;
		}	
    
    //Add new location to visited
    visited[nx + "," + ny] = my_color;
    
    //Paint!
    var visited_keys = Object.keys(visited)
		for(var i = 0, ii = visited_keys.length; i < ii; i++)
		{
      var temp_array = visited_keys[i].split(",")
      var temp_x = parseInt(temp_array[0])
      var temp_y = parseInt(temp_array[1])
			paint_cell(temp_x, temp_y, visited[visited_keys[i]]);
		}
		
		//Lets paint the score
		var score_text = "Score: " + score;
		ctx.fillText(score_text, 5, h-5);
	}
	
	//Lets first create a generic function to paint cells
	function paint_cell(x, y, color)
	{
		ctx.fillStyle = color;
		ctx.fillRect(x*cw, y*cw, cw, cw);
	}
	
	function check_collision(x, y, array)
	{
		//This function will check if the provided x/y coordinates exist
		//in an array of cells or not
		for(var i = 0; i < array.length; i++)
		{
			if(array[i].x == x && array[i].y == y)
			 return true;
		}
		return false;
	}
	
	//Lets add the keyboard controls now
  //use keydown to prevent sending multiple signals at once
	$(document).keydown(function(e){
		var key = e.which;
		//We will add another clause to prevent reverse gear
		if(key == "37" && direction != "right") direction = "left";
		else if(key == "38" && direction != "down") direction = "up";
		else if(key == "39" && direction != "left") direction = "right";
		else if(key == "40" && direction != "up") direction = "down";
		//The snake is now keyboard controllable
	})
  
  //prevent scrolling of window when playing TRON
	window.addEventListener("keydown", function(e) {
    // space and arrow keys
    if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
}, false);
	
	
	
	
	
	
})