var express = require('express');
var app     = express();
var server  = app.listen(3000);
var io      = require('socket.io').listen(server);
var Twitter = require('twit')


app.get('/:keyword', function(req, res)  {})

// Twitter OAuth - Please Enter Details here
 const client = new Twitter({
   consumer_key: 'aMMCReQp1ugdWWXrP8EeZa38S',
   consumer_secret: 'Lp0f3f4lYF1VPL9gjJbKKiA23gFH4KmX3gpOvrTNLYnv08T7VM',
   access_token: '22131888-ILmduPb9L9MhiLOkF2wCIE277e1AomQdStr6zzTUv',
   access_token_secret: 'rbX4AwNDetALOzwB5A75DsHUn5fJd9xfjiqBTlpt7tqH1'
 });


var keywordone = "",keywordtwo = "", streamOne, streamTwo,isStreamStarted = false, waitingTime = 0;

io.sockets.on('connection', function (socket) {
	// List for filter
	socket.on('filter', (params) => {
		console.log(params.keywordOne);
		console.log(params.keywordTwo);
		if(params.keywordOne && params.keywordTwo){
			UpdateStream(params.keywordOne,params.keywordTwo)
		}
	})
	
})

var statuses = { open : 1, closed: 2, waiting : 3, paused : 4}
var keywordStatus = {
	kw1 : statuses.closed,
	kw2 : statuses.closed
}



function newStream(keyword,skey) { 
	return client.stream('statuses/filter', { track: keyword })
		// on reconnect update waiting time, change status to waiting and call streamHander 
		.on('reconnect', function (request, response, connectInterval) {
			keywordStatus[skey] = statuses.waiting;
			if(waitingTime < connectInterval) {
				waitingTime = connectInterval;
			}
			streamHander();	
		})
		.on('connected', function (response) {
			keywordStatus[skey] = statuses.open;
			streamHander();
		});
}

function addTweetEmit(stream,emitFn){
	stream.on('tweet',emitFn);
}

function startStream(){
	addTweetEmit(streamOne,emitKeywordOne);
	addTweetEmit(streamTwo,emitKeywordTwo);
}



function streamHander(){
	// To ensure both streams are open at the time so graph client side is accurate
	// if one stream has to wait the other is paused
	
	if(keywordStatus.kw1 == statuses.open && keywordStatus.kw2 == statuses.open)
	{
		startStream();
	} else if(keywordStatus.kw1 == statuses.waiting && keywordStatus.kw2 == statuses.open) {
		// pause open stream
		streamTwo.stop();
		keywordStatus.kw2 = statuses.paused;
		console.log("stream 2 paused")
		emitWait()
	} else if(keywordStatus.kw1 == statuses.open && keywordStatus.kw2 == statuses.waiting){
		streamOne.stop();
		keywordStatus.kw1 = statuses.paused;
		console.log("stream 1 paused")
		emitWait()
	} else if (keywordStatus.kw1 == statuses.waiting && keywordStatus.kw2 == statuses.waiting){
		console.log("both waiting");
		emitWait()
	} 
	else if (keywordStatus.kw1 == statuses.open && keywordStatus.kw2 == statuses.paused){
		startStream();
		streamTwo.start();
		console.log("reconnect")
		waitingTime = 0;
	} else if (keywordStatus.kw1 == statuses.paused && keywordStatus.kw2 == statuses.open){
		startStream();
		streamOne.start();
		console.log("reconnect")
		waitingTime = 0;
	} 
		
}


function stopStream(){
	streamOne.stop();
	streamTwo.stop();
}

function UpdateStream(keywordOne,keywordTwo) {
    if(isStreamStarted) {
        stopStream();
    }
		
	streamOne = newStream(keywordOne,"kw1")
	streamTwo = newStream(keywordTwo,"kw2")
	isStreamStarted = true;
    
}
function emitKeywordOne (tweet) { io.sockets.emit('keywordOne',tweet);}
function emitKeywordTwo (tweet) { io.sockets.emit('keywordTwo',tweet);}
function emitWait () { io.sockets.emit('reconnect',waitingTime)}