// Definition of Player object.
var Player = function() {
	this.id 		= null;
	this.position 	= null;
	this.team 		= null;
	this.alive		= null;
	this.clock		= null;
}

Player.prototype = {

}

// Definition of Model object
var Model = function() {
	this.players 	= {};
	this.clock		= 0;
}

Model.prototype = {
	getPlayer: function(id) {
		var player = this.players[id];
		if (typeof(player) == 'undefined') {
			player = new Player();
			player.id = id;
			player.alive = true;
			this.players[id] = player;
		}
		return player;
	},
	update: function(frame) {
		// update clock
		if (typeof(frame.clock) == 'undefined') {
			return;
		}

		if (frame.clock != null) {
			this.clock = frame.clock;
		}

		// we are only interested in the packet if it has a clock / player / team values
		if (typeof(frame.position) != 'undefined' 
				&& typeof(frame.player_id) != 'undefined') {
			var player = this.getPlayer(frame.player_id);
			player.position = frame.position;
			player.team 	= frame.team;
			player.clock	= this.clock;
		}

		if (typeof(frame.target) != 'undefined'
				&& typeof(frame.destroyed_by) != 'undefined') {
			var player 	 = this.getPlayer(frame.target);
			player.alive = false;
			player.clock = this.clock;
		}
	}
}

function replay(data, overlay) {
	var ctx = overlay.getContext("2d");
	var clock = 0, i = 0;
	var model = new Model();
	var update = function(model, packets, start, window_size, start_ix) {
		var ix;
		for (ix = 0; (start_ix + ix) < packets.length; ix++) {
			var packet = packets[start_ix + ix];

			if (typeof(packet.clock) == 'undefined') {
				continue;
			}

			// escape when outside of window size
			if (packet.clock > (start + window_size)) {
				break;
			}

			// update model with packet
			model.update(packet);
		}

		show(data, model, ctx);
		
		var next_ix = start_ix + ix;
		if (next_ix < packets.length) {
			setTimeout(function() {
				update(model, packets, start + window_size, window_size, next_ix);
			}, 100);	
		}
	}

	update(model, data.packets, 0.0, 0.2, 0);
}

function show(data, model, ctx) {
	// reset overlay
	ctx.clearRect(0, 0, 500, 500);

	ctx.fillStyle = "#FFFF00";
	ctx.textBaseline = "top";
	ctx.font = "bold 20px sans-serif";
	ctx.fillText(String(model.clock.toFixed(2)), 8, 5);

	for (var player_id in model.players) {
		var player = model.players[player_id];
		if (typeof(player.team) == undefined
				|| player.position == null
				|| [0,1].indexOf(player.team) < 0) {
			continue;
		}

		var coord = to_2d_coord(player.position, [-500, 500, -500, 500], 500, 500);
		
		var colors = [
			[0, 255, 0],
			[255, 0, 0]
		];

		var recorder_color = [0, 0, 255];

		ctx.lineWidth = 2;
		var color = player.id == data.recorder_id ?  recorder_color : colors[player.team];
		var age   = player.alive ? ((model.clock - player.clock) / 20) : 0;
		age = age > 0.66 ? 0.66 : age;
		var style = "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + (1 - age) +  ")";

		ctx.strokeStyle = ctx.fillStyle = style;
		ctx.beginPath();
		ctx.arc(coord.x, coord.y, 3, 0, 2*Math.PI);

		if (player.alive) {
			ctx.fill();
		} else {
			ctx.stroke();	
		}
	}
}

function to_2d_coord(position, map_boundaries, width, height) {
    var x = position[0], y = position[2], z = position[1];
    x = (x - map_boundaries[0]) * (width / (map_boundaries[1] - map_boundaries[0] + 1));
    y = (map_boundaries[3] - y) * (height / (map_boundaries[3] - map_boundaries[2] + 1));
    return { x: x, y: y };
}

function initViewer(target, webservice) {
	// process window url
	var hash = window.location.hash;
	if (hash.length) {
		var id = hash.substr(1);
		fetchReplay(target, webservice, id);
	}
}

function fetchReplay(target, webservice, id) {
	// send data request
	var replayRequest = new XMLHttpRequest();
	replayRequest.open("POST", webservice, true);
	
	replayRequest.onreadystatechange = function(state) {
		if(replayRequest.readyState != XMLHttpRequest.DONE) {
			return;
		}

		// proces data
		var data = JSON.parse(replayRequest.response)
		var mapURL = 'maps/' + data["map"] + "_" + data["mode"] + ".png";
		var map = document.getElementsByClassName("map")[0];
		map.setAttribute('src', mapURL);

		map.classList.remove('loading');

		// play
		var overlay = document.getElementsByClassName("overlay")[0];
		replay(data, overlay);
	}

	var formData = new FormData();
	formData.append("id", id);
	replayRequest.send(formData);
}

function processNewReplay(target, webservice, file) {
	// send data request
	var replayRequest = new XMLHttpRequest();
	replayRequest.open("POST", webservice, true);
	
	replayRequest.onreadystatechange = function(state) {
		if(replayRequest.readyState != XMLHttpRequest.DONE) {
			return;
		}

		// proces data
		var data = JSON.parse(replayRequest.response)
		var mapURL = 'maps/' + data["map"] + "_" + data["mode"] + ".png";
		var map = document.getElementsByClassName("map")[0];
		map.setAttribute('src', mapURL);

		map.classList.remove('loading');

		// play
		var overlay = document.getElementsByClassName("overlay")[0];
		replay(data, overlay);
	}

	var formData = new FormData();
	formData.append("file", file);
	replayRequest.send(formData);
}

function setup(target, webservice) {
	// configure the target element as a replay viewer
	target.classList.add('replay-viewer');

	var map = document.createElement('img');
	map.classList.add('map');
	map.classList.add('loading');
	map.width = map.height = 500
	target.appendChild(map);

	var overlay = document.createElement('canvas');
	overlay.classList.add('overlay');
	overlay.width = overlay.height = 500;
	target.appendChild(overlay);

	initViewer(target, webservice);
}