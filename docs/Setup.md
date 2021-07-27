# Setup

Here are the steps to setup your own dana server.

## Requirements

As a requirement, you need to have node.js installed on your machine. [See nodejs download](https://nodejs.org/en/download/).

## Instructions for Mac/Linux

First, install dependent node modules

```
$ npm install
```

Second, you need to create a **configs** directory. The database and temporary dana working files will be created in this directory.

```
$ mkdir configs
```

Then, you have to create a **configs/dana.js** file that will provide
- *adminUser* property to specify the *login*, *password* and *email* of the administrator of your dana server.
- *server* property to specify the *ip* and *port* to use from the browser

This file should be like this:

```
module.exports = {
  adminUser: {
    username: 'admin',
    password: 'admin',
    email: 'youremail@google.com'
  },
  server: {
    ip:'localhost',
    port: 7000
  },
  sessionSecret: "some random string",
  apiToken: "some token"
}
```

You're ready to run the server :)

Note you need to add some pages for the projects. See [adding project pages](Project.md) to know how to add pages to the dashboard for a project).

To start the server, there are two options:

```
$ node src/server.js
or
$ npm start
```

## Configure email account

Dana provides a way to use a gmail account to send emails using Gmail APIs. Follow [these steps](http://pcarion.com/2015/12/06/How-to-send-a-mail-in-node-using-the-gmail-API.html) to get **clientsecret.json** and **gmail-credentials.json**. Then put these 2 files in **configs/** directory and restart Dana server.
