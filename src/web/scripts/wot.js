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

var Viewer = function(target, serviceUrl) {
	this.target = target;
	this.serviceUrl = serviceUrl;
	this.model = null;

	// configure the target element as a replay viewer
	target.classList.add('replay-viewer');

	this.map = document.createElement('img');
	this.map.classList.add('map');
	this.map.width = this.map.height = 500
	this.target.appendChild(this.map);

	this.overlay = document.createElement('canvas');
	this.overlay.classList.add('overlay');
	this.overlay.width = this.overlay .height = 500;
	this.target.appendChild(this.overlay);

	var hash = window.location.hash;
	if (hash.length) {
		var id = hash.substr(1);
		this.fetch(id);
	}
}

Viewer.prototype = {
	replay: function(data) {
		var ctx = this.overlay.getContext("2d");
		this.model = new Model();

		var update = function(model, packets, window_start, window_size, start_ix) {
			// model of the viewer change -> stop
			if (this.model != model) {
				return;
			}

			var window_end = window_start + window_size, ix;
			for (ix = start_ix; ix < packets.length; ix++) {
				var packet = packets[ix];

				if (typeof(packet.clock) == 'undefined') {
					continue;
				}

				// escape when outside of window size
				if (packet.clock > window_end) {
					break;
				}

				// update model with packet
				model.update(packet);
			}

			this.show(data, ctx);
			
			if (ix < packets.length) {
				setTimeout(update.bind(this, model, packets, window_end, window_size, ix), 100);	
			}
		}

		update.call(this, this.model, data.packets, 0.0, 0.2, 0);
	},
	show: function(data, ctx) {
		// reset overlay
		ctx.clearRect(0, 0, 500, 500);

		ctx.fillStyle = "#FFFF00";
		ctx.textBaseline = "top";
		ctx.font = "bold 20px sans-serif";
		ctx.fillText(String(this.model.clock.toFixed(2)), 8, 5);

		for (var player_id in this.model.players) {
			var player = this.model.players[player_id];
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
			var age   = player.alive ? ((this.model.clock - player.clock) / 20) : 0;
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
	},
	fetch: function(id) {
		this.serviceRequest({id: id});
	},
	process: function(file) {
		this.serviceRequest({file: file});
	},
	serviceRequest: function(values) {
		// send data request
		var replayRequest = new XMLHttpRequest();
		replayRequest.open("POST", this.serviceUrl, true);
		
		var map = this.map;
		var viewer = this;
		map.classList.add('loading');
		replayRequest.onreadystatechange = function(state) {
			if(replayRequest.readyState != XMLHttpRequest.DONE) {
				return;
			}

			// proces data
			var data = JSON.parse(replayRequest.response)
			var mapURL = 'maps/' + data["map"] + "_" + data["mode"] + ".png";
			map.setAttribute('src', mapURL);
			map.classList.remove('loading');

			// play
			viewer.replay(data);
		}

		var formData = new FormData();
		for (key in values) {
			formData.append(key, values[key]);
		}

		replayRequest.send(formData);
	}
}

function to_2d_coord(position, map_boundaries, width, height) {
    var x = position[0], y = position[2], z = position[1];
    x = (x - map_boundaries[0]) * (width / (map_boundaries[1] - map_boundaries[0] + 1));
    y = (map_boundaries[3] - y) * (height / (map_boundaries[3] - map_boundaries[2] + 1));
    return { x: x, y: y };
}