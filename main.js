var log = console.log;
var debug = require("debug")("SLT:debug");
var moment = require('moment');

var program = require("commander");
program
  .version('0.0.1')
  .usage('[options]')
  .option('-h, --host [host[:port]]', 'Socker server address [localhost:8090]', "http://localhost:8090")
  .option('-c, --count <count>', 'Number of connections to make [10]', 10)
  .option('-r, --reconnect', 'Try to reconnect [true]', true)
  .option('-p, --progress <ms>', 'Show progress [1000ms]', 1000)
  .option('-d, --delay <ms>', 'Delay between connections [200ms]', 200)
  .option('--cooldown <ms>', 'Delay before shutting down [10000]', 10000)
  .option('--talk', 'Talk to ther server')
//  .option('-u, --user [username]', 'Username to fetch access token', '+990000000000')
  .parse(process.argv);

var io = require("socket.io-client");

var host = program.host, accessToken = "54ada23505a2f84a51224ac6ba97b274";
var currentIndex = 0;
var sockets = [];
var shuttingDown = false;
var showProgress = (program.progress === '0') ? false : true;
var progressLoop = 0;
var bootLoop = 0;
var heartBeatLoop = 0;

var stats = {
  host: host,
  count: program.count,
  reconnection: program.reconnect,
  connectionDelay: program.delay,
  shutDownDelay: program.cooldown,
  startTime: Date.now(),
  connects: [],
  receives: [],
  errors: [],
  disconnects: [],
  timeouts: [],
  prematureDCs: [],
};

var start = function() {
  log("Load Testing Whistle Socket Server");
  log("Host %s will get %d connections", host, stats.count);
  bootLoop = setInterval(function() {
    debug("Connecting: " + currentIndex);
    connectClient(currentIndex);
    currentIndex++;
    if (currentIndex >= stats.count) {
      debug("Stopping boot loop. Current Index: %d", currentIndex);
      clearInterval(bootLoop);
      //shutDown('finished connecting');
    }
  }, stats.connectionDelay);
  
  // Start heartbeat loop
  heartBeatLoop = setInterval(function() {
    var heartbeatsCount = stats.connects.length;
    for (var i=0; i<heartbeatsCount; i++) {
      var sock = sockets[i];
      sock.emit('hearbeat');
    }
    log("Sent %d heartbeats at %s", heartbeatsCount, new Date());
  }, 50000);
};

function connectClient(index) {
  var socket = io.connect(host, {
    "force new connection": true,
    query: "accessToken=" + accessToken,
    transports: ['websocket'],
    recoonection: stats.reconnection,
    timeout: 5000,
  });

  socket.index = index;

  sockets.push(socket);

  socket.on('connect', function(){
    debug("Connected: " + socket.index);
    stats.connects.push(socket.index);
    if (socket.index === stats.count - 1 && !shuttingDown) {
      socket.emit('sendPings', {});
      shutDown('last client connected');
    }
  });

  socket.on('error', function(e){
    debug(e);
    stats.errors.push(socket.index);
    if (socket.index === stats.count - 1 && !shuttingDown) {
      shutDown('last client errored out');
    }
  });

  socket.on('connection_timeout', function(e) {
    debug(e);
    stats.timeouts.push(socket.index);
    if (socket.index === stats.count - 1  && !shuttingDown) {
      shutDown('last client timed out');
    }
  });

  socket.on('welcome',function(message){
    debug("Recevied %s", message.id);
  });

  socket.on('ping',function(){
    debug("Recevied ping at: " + socket.index);
    stats.receives.push(socket.index);
  });
  
  socket.on("disconnect",function(){
    if (!shuttingDown) {
      log("Disconnecting before shutdown: " + socket.index);
      stats.prematureDCs.push(sockets.index);
    }
    debug("Disconnected: " + socket.index);
    stats.disconnects.push(socket.index);
  });
}

function disconnect() {
  log("Disconnecting %d sockets.", sockets.length);
  for (var i = 0; i < sockets.length; i++) {
    try{
      sockets[i].disconnect();
    } catch (e) {
      log(e);
      log("Index: " + i);
      log(sockets[i]);
    }
  }
}
function postProcess() {
  function numeric (a, b) { return a - b; }
  stats.connects.sort(numeric);
  stats.receives.sort(numeric);
  stats.errors.sort(numeric);
  stats.timeouts.sort(numeric);
  stats.disconnects.sort(numeric);
  
  if (stats.count !== stats.connects.length) {
    if (stats.count - stats.connects.length !== stats.errors.length) {
      stats.missing = stats.count - (stats.connects.length + stats.errors.length);
    }
  }
}

function printStats() {
  log("Total Attempted: " + stats.count);
  log("Connects: " + stats.connects.length);
  log("Disconnects: " + stats.disconnects.length);
  log("Receives: " + stats.receives.length);
  log("Errors: " + stats.errors.length);
  log("Timeouts: " + stats.timeouts.length);
  log("Premature DCs: " + stats.prematureDCs.length);
  log("Missing: " + stats.missing);
  
  var fs = require('fs');
  fs.appendFileSync("./logs.json", JSON.stringify(stats) + "\n");
}

function shutDown(event) {
  if (shuttingDown === false) {
    debug('Shutting down after: ' + event);
    shuttingDown = true;
    log("Shutting down in %d seconds...", stats.shutDownDelay/1000);
    clearInterval(progressLoop);
    clearInterval(heartBeatLoop);
    setTimeout(shutDown, stats.shutDownDelay);
  } else {    
    disconnect();
    stats.endTime = Date.now();
    postProcess();
    printStats();
    log("Test lasted: " + moment.duration(stats.endTime-stats.startTime).humanize());
    process.exit(0);
  }
}

start();

if (showProgress) {
  debugger;
  progressLoop = setInterval(function() {
    if (shuttingDown === false) {
      log("Tried: %d Connected: %d Errors: %d Timeouts: %d", sockets.length, stats.connects.length, stats.errors.length, stats.timeouts.length);
    }
  }, program.progress);  
}

process.on('SIGINT', function() {
  clearInterval(progressLoop);
  log("Received SIGINT from user.");
  shutDown("Forced stop");
});