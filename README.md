## Socket Load Tester

#### Features
* Collects results in a log file
* Can interrupt with `Ctrl+C` to stop making new connections and show stats
* Sends a hearbeat every 50 seconds for each connected socket

#### Setup

1. git clone https://github.com/OneWhistle/socketLoadTester
2. cd socketLoadTester
3. npm install
4. node main.js --help

#### Usage
```
  Usage: main [options]

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
    -h, --host [host[:port]]  Socker server address [localhost:8090]
    -c, --count <count>       Number of connections to make [10]
    -r, --reconnect           Try to reconnect [true]
    -p, --progress <ms>       Show progress [1000ms]
    -d, --delay <ms>          Delay between connections [200ms]
    --cooldown <ms>           Delay before shutting down [10000]
    --talk                    Talk to ther server
```


#### Examples

```
$ node main.js -h http://api.dowhistle.com -c 3000 -d 500 --cooldown 10000 --progress 5000
```
- sends requests to the whistle api server
- sends a total of 3000 socket connections
- maintains a delay of 500ms between each new connection
- Before disconnecting sockets, waits for 10 seconds after all sockets connect
- shows progress every 5 seconds

```
$ DEBUG="SLT:debug" node main.js -h http://api.dowhistle.com -c 3000 -d 500 --cooldown 10000 --progress 5000
```
Displays debug messages 