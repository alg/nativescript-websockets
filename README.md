# NativeScript WebSockets

This is a cross platform WebSocket library for IOS and Android.   

## License

My code is (c)2015, Master Technology.  All my code is LICENSED under the MIT Licesnse. Any other libraries used may have different licenses; which you may view them by reading the "LICENSE" file.  

I do contract work; so if you have a module you want built for NativeScript (or pretty much any other language) feel free to contact me (nathan@master-technology.com).

## Installation 
  
First run `tns --version`

### v1.4 or later

Run `tns plugin add nativescript-websockets` in your ROOT directory of your project.

## Limitations
* The sending of Protocols support is not fully implemented on both platforms.  Do not depend on this; it only partially works..

## Usage 

There is two possible interfaces for you to use; the Simple WebSocket interface that emulates the browser based WebSockets and a more advanced WebSocket interface where you have more control.

### Browser based Interface 
```js
require('nativescript-websockets');

var mySocket = new WebSocket("ws://echo.websocket.org", [ /* "protocol","another protocol" */]);
mySocket.addEventListener('open', function (evt) { console.log("We are Open"); evt.target.send("Hello"); });
mySocket.addEventListener('message', function(evt) { console.log("We got a message: ", evt.data); evt.target.close(); });
mySocket.addEventListener('close', function(evt) { console.log("The Socket was Closed:", evt.code, evt.reason); });
mySocket.addEventListener('error', function(evt) { console.log("The socket had an error", evt.error); });

```

### Advanced Interface
```js
var WS = require('nativescript-websockets');

var mySocket = new WS("ws://echo.websocket.org",{protocols: [/* 'chat', 'video' */], timeout: 6000, allowCellular: true});
mySocket.on('open', function(socket) { console.log("Hey I'm open"); socket.send("Hello"); });
mySocket.on('message', function(socket, message) { console.log("Got a message", message); });
mySocket.on('close', function(socket, code, reason) { console.log("Socket was closed because: ", reason, " code: ", code); });
MySocket.on('error', function(socket, error) { console.log("Socket had an error", error);});

```

### Browser Based WebSockets

The browser based WebSockets are virtually identical to what you would get if you were using a Browser; they are automatically opened when you create it; all four events have "event" objects with different values.  You are not allowed to re-open a closed socket and you have no control over any additional features.  

#### Create and OPENS a new BROWSER based WebSocket
#### new WebSocket(url, [protocols]);
##### Parameters
* URL - (String) - Web Socket URL to open
* Protocols - OPTIONAL (Array of String) - valid list protocols.  Please see limitations note.   

#### Attaches an event to the WebSocket
#### .attachEventListener(EventName, function)
#### .on(EventName, function)
##### Parameters
* EventName - (String) can be "open", "close", "message" and "error"
* function  - (Function) the function that will be called when the event occurs


### Advanced WebSockets

The Advanced WebSockets allow you a lot more control over setting up and creating; in addition if they are closed; you can re-open it without having to reset your events.

#### Create a new Advanced WebSocket
#### var WS = require('nativescript-websockets');   var ws = new WS(url, options); 
##### Parameters
* URL - Url to Open
* Options 
** protocols - (Array of string) - Valid protocols.  (See Limitation note)
** timeout - timeout  (Defaults to 60,0000ms on IOS amd 10,000ms on Android, setting this to 0 disables timeouts)
** allowCellular (ios only, defaults to True) - can disable the WebSocket from going over the cellular network

#### Attaches an event to the WebSocket
#### .attachEventListener(EventName, function, passedThis)
#### .on(EventName, function, passedThis)
##### Parameters
* EventName - (String) can be "open", "close", "message" and "error"
* Function  - (Function) the function that will be called when the event occurs
* passedThis - the "this" you want the Function to have

#### Opens the WebSocket
#### .open()
##### Notes: in the Advanced WebSocket you can re-open a closed WebSocket...




### Common Functions between Advanced and Browser WebSockets

#### Closes the open Socket
#### .close(code, reason)
##### Parameters
* code - OPTIONAL (Number) - code
* reason - OPTIONAL (String) - reason 

#### Sends a Text or Binary Message
#### .send(message)
##### Parameters
* message - String or Array/ArrayBuffer - Text string or Binary Message to send

#### Retrieves the current State
#### .readyState 
##### Values:
* 0 - Connection
* 1 - Open
* 2 - Closing
* 3 - Closed

#### The URL you opened
#### .url

#### Returns the protocol negotiated
#### .protocol
##### Please see notes on limitations.

#### Returns true if on IOS
#### .ios

#### Return true if on Android
#### .android

#### Remove an Event Listener
#### .removeEventListener (EventName, function)
#### .off(EventName, function)
##### Parameters
* EventName - (String) - Name of Event (open, close, message, error)
* function - (optional Function) - If you don't pass any function to this; this will remove ALL event listeners for that event, otherwise it will just remove that one event listener.

#### Check to see if it is open
#### .isOpen()
##### Returns true if the connection is open

#### Check to see if it is closed
#### .isClosed()
##### Returns true if the connection is closed

#### Check to see if it is connecting
#### .isConnecting()
##### Returns true if the connection is connecting

#### Check to see if the connection is closing
#### .isClosing()
##### Returns true if it is in the process of closing...


