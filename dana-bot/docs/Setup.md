# Setup

Here are the steps to setup your own dana-bot server.

## Requirements

As a requirement, you need to have node.js installed on your machine. [See nodejs download](https://nodejs.org/en/download/).

## Instructions for Mac/Linux

### Install modules

First, install dependent node modules

```
$ npm install
```

### Create config directory

Second, you need to create a **configs** directory. The database and temporary dana-bot working files will be created in this directory.

```
$ mkdir configs
```

### Create bot.js configuration file

See [how to create bot.js configuration file](bot.js.md)

### Create project directory

See [how to create a project](project.md)

### Run

You're ready to run the server :)

To start the server, there are two options:

```
$ node src/server.js
or
$ npm start
```

*dana-bot* has a web interface on the port defined in bot.js configuration file. Just open it using the url **http://config.ip:config.port** (for example http://localhost:5051/)

### Configure email account

Dana-bot provides a way to use a gmail account to send emails using Gmail APIs. Follow [these steps](http://pcarion.com/2015/12/06/How-to-send-a-mail-in-node-using-the-gmail-API.html) to get **clientsecret.json** and **gmail-credentials.json**. Then put these 2 files in **configs/** directory and restart Dana-bot server.

## Adding repositories and tasks

See other docs:
- [repositories management](repositories.md)
- [tasks management](tasks.md)
