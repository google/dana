# Demo

Here are the steps to setup a dana server with some random benchmarks/projects.

As a requirement, you need to have node.js installed on your machine. [See nodejs download](https://nodejs.org/en/download/).

## Instructions for Mac/Linux

```
$ npm install
$ cp -r demo/configs configs
$ cp -r demo/projects www/views/projects
$ node src/server.js
```

## Feeding fake data

In order to feed some fake data to see the dashboard in action:

```
$ cd dana-websocket-client
$ node pullDummyData.js 100 100 100
```

You're ready to go!

## Accessing dana

[Just open a browser on http://localhost:7000](http://localhost:7000/).

Enjoy :)
