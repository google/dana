# bot.js configuration file

This file must be in **configs/bot.js** and defines several properties:

```
module.exports.config = {
  system: name of the bot that will be shown on the web interface
  ip: localhost or IP or DNS name of the computer that will run the bot
  port: dana-bot needs 2 ports to run (port and port+1)
  runners: {  // Contains all configurations for running the tests/benchmarks
    "Name of the configuration": {
      cpu: Maximum number of cpu to use,
      sys: Used to identify the system (can be 'OSX', 'windows', 'ubuntu', ...)
    }
  },
  admin: {          
    name: name of the admin user,
    password: password of the admin user
  }
}
```

Example:

```
module.exports.config = {
  system: 'MyComputer',  
  ip: 'localhost',    
  port: 5051,         
  runners: {          
    "prime": {        
      cpu: 12,        
      sys: 'OSX'
    }
  },
  admin: {          
    name: 'admin',   
    password: 'admin'
  }
}
```
