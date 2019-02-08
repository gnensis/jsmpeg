// Use the websocket-relay to serve a raw MPEG-TS over WebSockets. You can use
// ffmpeg to feed the relay. ffmpeg -> websocket-relay -> browser
// Example:
// node websocket-relay yoursecret 8081 8082
// ffmpeg -i <some input> -f mpegts http://localhost:8081/yoursecret

var fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws');

if (process.argv.length < 3) {
	console.log(
		'Usage: \n' +
		'node websocket-relay.js <secret> [<stream-port> <websocket-port>]'
	);
	process.exit();
}

var STREAM_SECRET = process.argv[2],
	STREAM_PORT = process.argv[3] || 8081,
	WEBSOCKET_PORT = process.argv[4] || 8082,
	RECORD_STREAM = false;

// Websocket Server
var socketServer = new WebSocket.Server({port: WEBSOCKET_PORT, perMessageDeflate: false});
socketServer.connectionCount = 0;
socketServer.on('connection', function(socket, upgradeReq) {
	socketServer.connectionCount++;
	console.log(
		'New WebSocket Connection: ', 
		(upgradeReq || socket.upgradeReq).socket.remoteAddress,
		(upgradeReq || socket.upgradeReq).headers['user-agent'],
		'('+socketServer.connectionCount+' total)'
	);
    var param = upgradeReq.url.substr(1).split('/');
    var chnid = param[0];
    var chnidStr = chnid.toString();
    console.log('chnid: ' + chnid);
    console.log('socket: ' + socket);
    console.log('upgradeReq: ' + upgradeReq);
    for(var chn in socketServer.connection){
        if(chnidStr == chn){
            console.log('chn: ' + chn + 'already exist.');
            //upgradeReq.end();
        }
    }

    if(!socketServer.connection){
        socketServer.connection = new Object();    
    }

    if(!socketServer.connection[chnidStr]){
        socketServer.connection[chnidStr] = new Object();
        socketServer.connection[chnidStr].count = new Object();
        socketServer.connection[chnidStr].clients = new Set();
        socketServer.connection[chnidStr].count  = 1;
        socketServer.connection[chnidStr].clients.add(socket);
    }else{
        socketServer.connection[chnidStr].count++;
        socketServer.connection[chnidStr].clients.add(socket);
    }

    console.log('socketServer.connection[' + chnid + '].count: ' + socketServer.connection[chnidStr].count);

    socket.on('close', function(code, message){
		socketServer.connectionCount--;
		console.log(
			'Disconnected WebSocket ('+socketServer.connectionCount+' total)'
		);
        for(var chn in socketServer.connection){
            socketServer.connection[chn].clients.forEach(function each(client) {
                if (client.readyState != WebSocket.OPEN) {
                    socketServer.connection[chn].clients.delete(client);
                    socketServer.connection[chn].count--;
                }
            });
            
            console.log('scoketServer.connection[' + chn + '].count: ' + socketServer.connection[chn].count);
        }
	});
});
socketServer.broadcast = function(channel, data) {
    for(var chn in socketServer.connection){
        //console.log('chn: ' + chn);
        //console.log('channel: ' + channel);
        if(chn == channel){
            socketServer.connection[chn].clients.forEach(function each(client) {
		        if (client.readyState === WebSocket.OPEN) {
			        client.send(data);
		        }
            });
        }
	}
};

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var streamServer = http.createServer( function(request, response) {
	var params = request.url.substr(1).split('/');

    if (params[0] !== STREAM_SECRET) {
		console.log(
			'Failed Stream Connection: '+ request.socket.remoteAddress + ':' +
			request.socket.remotePort + ' - wrong secret.'
		);
		response.end();
	}

    var chnid = params[1];
    console.log('Channel id: ' + chnid);

	response.connection.setTimeout(0);
	console.log(
		'Stream Connected: ' + 
		request.socket.remoteAddress + ':' +
		request.socket.remotePort
	);
	request.on('data', function(data){
		socketServer.broadcast(chnid, data);
		if (request.socket.recording) {
			request.socket.recording.write(data);
		}
	});
	request.on('end',function(){
		console.log('close');
		if (request.socket.recording) {
			request.socket.recording.close();
		}
	});

	// Record the stream to a local file?
	if (RECORD_STREAM) {
		var path = 'recordings/' + Date.now() + '.ts';
		request.socket.recording = fs.createWriteStream(path);
	}
}).listen(STREAM_PORT);

console.log('Listening for incomming MPEG-TS Stream on http://127.0.0.1:'+STREAM_PORT+'/<secret>');
console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');
