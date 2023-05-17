import WebSocket from "ws";
var url = "ws://localhost:7001";

var danaWs;
var danaHdl;

function connectToDana() {
  danaWs = new WebSocket(url);
  danaWs.on("open", function connection(err) {
    console.log("Connected to Dana");
    iAmConnectedToDana();
  });
  danaWs.on("message", function (msg, flags) {
    console.log("Message from Dana", msg);
  });
  danaWs.on("error", function error(err) {
    console.log("Error from Dana", err);
  });
  danaWs.on("close", function close() {
    console.log("Disconnected from Dana");
  });
}

function iAmConnectedToDana() {
  var data = {
    api: "addBuild",
    projectId: "Test",
  };
  danaWs.send(JSON.stringify(data));

  var data = {
    api: "addSerie",
    projectId: "Test",
  };
  danaWs.send(JSON.stringify(data));

  var data = {
    api: "addSample",
    projectId: "Test",
  };
  danaWs.send(JSON.stringify(data));
}

connectToDana();
