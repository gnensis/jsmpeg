# My Usage.
## My Usage
1)Player Page.

Put the 'Player.html' in the html document folder of a Web Server.

2)Start Relayer.

```sh
node websocket-relay.js 123456 8080 8082
```

3)Push Stream from OSX

```sh
ffmpeg -f avfoundation -framerate 30 -i "0" -f mpegts -codec:v mpeg1video -b 5000k -r 20 -vf scale=720:576 http://172.16.99.131:8080/123456/0001
```

```sh
ffmpeg -f avfoundation -framerate 30 -i "1" -f mpegts -codec:v mpeg1video -b 5000k -r 20 -vf scale=720:576 http://172.16.99.131:8080/123456/0002
```
