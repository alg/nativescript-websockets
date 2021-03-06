/*****************************************************************************************
 * (c) 2015, Master Technology
 * Licensed under the MIT license or contact me for a support, changes, enhancements,
 * and/or if you require a commercial licensing
 *
 * Any questions please feel free to email me or put a issue up on github
 *
 * Version 0.0.3                                             Nathan@master-technology.com
 ****************************************************************************************/
"use strict";

/* jshint node: true, browser: true, unused: true, undef: false */
/* global android, java, javax, org, require, module */

// --------------------------------------------

var commonWebSockets = require("./websockets-common");

/**
 * Checks for running on a emulator
 * @returns {boolean}
 */
var checkForEmulator = function() {
    //noinspection JSUnresolvedVariable
    var res = android.os.Build.FINGERPRINT;
    return res.indexOf("generic") !== -1;
};


// IPV6 doesn't work properly on emulators; so we have to disable it
if (checkForEmulator()) {
    //noinspection JSUnresolvedVariable
    java.lang.System.setProperty("java.net.preferIPv6Addresses", "false");
    //noinspection JSUnresolvedVariable
    java.lang.System.setProperty("java.net.preferIPv4Stack", "true");
}

//noinspection JSUnresolvedVariable
/**
 * This is our extended class that gets the messages back from the Native ANDROID class
 * We use a thin shell to just facilitate communication from ANDROID to our JS code
 * We also use this class to try and standardize the messages
 */
var _WebSocket = org.java_websocket.client.WebSocketClient.extend({
    wrapper: null,
    onOpen: function () {
        if (this.wrapper) {
            this.wrapper._notify("open", [this.wrapper]);
        }
    },
    onClose: function (code, reason) {
        if (this.wrapper) {
            this.wrapper._notify("close", [this.wrapper, code, reason]);
        }
    },
    onMessage: function (message) {
        if (this.wrapper) {
            this.wrapper._notify("message", [this.wrapper, message]);
        }
    },
    onMessageBinary: function(binaryMessage) {
        if (this.wrapper) {

            // Make sure binaryMessage is at beginning of buffer
            //noinspection JSUnresolvedFunction
            binaryMessage.rewind();

            // Convert Binary Message into ArrayBuffer/Uint8Array
            //noinspection JSUnresolvedFunction
            var count = binaryMessage.limit();            
            var view = new Uint8Array(count); 
            for (var i=0;i<count;i++) {
                view[i] = binaryMessage.get(i);
            }
            binaryMessage = null;
            
            this.wrapper._notify("message", [this.wrapper, view.buffer]); }
    },
    onError: function (err) {
        if (this.wrapper) {
            this.wrapper._notify("error", [this.wrapper, err]);
        }
    },
    onFragment: function (fragment) {
        if (this.wrapper) {
            this.wrapper._notify("fragment", [this.wrapper, fragment]);
        }
    },
    onWebsocketHandshakeReceivedAsClient: function (handshake) {
        console.log(handshake);
        if (this.wrapper) {
            this.wrapper._notify("handshake", [this.wrapper, handshake]);
        }
    }
});

/**
 * This is the Constructor for creating a WebSocket
 * @param url {String} - url to open, "ws://" or "wss://"
 * @param options {Object} - options
 * @constructor
 */
var NativeWebSockets = function(url, options) {
    options = options || {};
    this._callbacks = {open: [], close: [], message: [], error: [], fragment: [], handshake: []};
    this._hasOpened = false;
    this._queue = [];
    this._queueRunner = null;

    // TODO: Replace Hack when we support protocols in Android; we want to "emulate" that the first protocol sent was accepted
    this._protocol = options.protocols && options.protocols[0] || "";

    this._browser = !!options.browser;
    this._timeout = options.timeout;
    this._url = url;

    //noinspection JSUnresolvedVariable
    this._proxy = options.proxy;

    this._timeout = options.timeout || 10000;

    this._reCreate();
};

/**
 * This function is used to open and re-open sockets so that you don't have to re-create a whole new websocket class
 * @private
 */
NativeWebSockets.prototype._reCreate = function() {

    //noinspection JSUnresolvedVariable,JSUnresolvedFunction
    var uri = new java.net.URI(this._url);

    //noinspection JSUnresolvedVariable,JSUnresolvedFunction
    this._socket = new _WebSocket(uri, new org.java_websocket.drafts.Draft_17(), this._timeout);

    //noinspection JSValidateTypes
    this._socket.wrapper = this;

    // check for Proxy
    var proxy = null;
    if (this._proxy) {
        if (String.isString(this._proxy)) {
            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            proxy = new java.net.Proxy(java.net.Proxy.Type.HTTP, new java.net.InetSocketAddress( this._proxy, 80 ) );
        } else {
            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            proxy = new java.net.Proxy(java.net.Proxy.Type.HTTP, new java.net.InetSocketAddress( this._proxy.address, this._proxy.port || 80 ) );
        }
    }
    if (proxy) {
        //noinspection JSUnresolvedFunction
        this._socket.setProxy(proxy);
    }

    // Check for SSL/TLS
    if (this._url.indexOf("wss:") === 0) {
		this._socket.setupSSL();
		// This below code is currently broken in NativeScript; so we had to embed the SSL code in the Websocket library.
		// TODO: Re-enable this once it is fixed in NativeScript so that the end user can actually setup the specific
		// SSL connection he wants...
		
        /* //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var sslContext = javax.net.ssl.SSLContext.getInstance( "TLS" );
        sslContext.init( null, null, null );
        //noinspection JSUnresolvedFunction
        var socketFactory = sslContext.getSocketFactory();
        //noinspection JSUnresolvedFunction
        this._socket.setSocket( socketFactory.createSocket() ); */
    }
};

/**
 * This function is used to send the notifications back to the user code in the Advanced webSocket mode
 * @param event {String} - event name ("message", "open", "close", "error")
 * @param data {String|Array|ArrayBuffer}
 * @private
 */
NativeWebSockets.prototype._notify = function(event, data) {
    var eventCallbacks = this._callbacks[event];
   for (var i=0;i<eventCallbacks.length;i++) {
       if (eventCallbacks[i].t) {
           eventCallbacks[i].c.apply(eventCallbacks[i].t, data);
       } else {
           eventCallbacks[i].c.apply(this, data);
       }
   }
};

/**
 * This function is used to send the notifications back to the user code in the Browser webSocket mode
 * @param event {String} - Event name ("message", "open", "close", "error")
 * @param data {String|Array|ArrayBuffer} - The event Data
 * @private
 */
NativeWebSockets.prototype._notifyBrowser = function(event, data) {
    var eventResult;
    switch (event) {
        case 'open':
            eventResult = new commonWebSockets.Event({currentTarget: this, srcElement: this, target: this, type: event});
            if (typeof this.onopen === "function") {
                this.onopen.call(this, eventResult);
            }
            break;
        case 'close':
            eventResult = new commonWebSockets.Event({currentTarget: this, srcElement: this, target: this, type: event, code: data[1], reason: data[2], wasClean: data[3]});
            if (typeof this.onclose === "function") {
                this.onclose.call(this, eventResult);
            }
            break;
        case 'message':
            eventResult = new commonWebSockets.Event({currentTarget: this, srcElement: this, target: this, type: event, data: data[1], ports: null, source: null, lastEventId: ""});
            if (typeof this.onmessage === "function") {
                this.onmessage.call(this,eventResult);
            }
            break;
        case 'error':
            eventResult = new commonWebSockets.Event({currentTarget: this, srcElement: this, target: this, type: event, error: data[1], filename: "", lineno: 0});
            if (typeof this.onerror === "function") {
                this.onerror.call(this,eventResult);
            }
            break;
        default: return;
    }
    var eventCallbacks = this._callbacks[event];
    for (var i=0;i<eventCallbacks.length;i++) {
        eventCallbacks[i].c.call(this, eventResult);
    }
};

/**
 * Attach an event to this webSocket
 * @param event {String} - Event Type ("message", "open", "close", "error")
 * @param callback {Function} - the function to run on the event
 * @param thisArg {Object} - the "this" to use for calling your function, defaults to this current webSocket "this"
 */
NativeWebSockets.prototype.on = function(event, callback, thisArg) {
    this.addEventListener(event, callback, thisArg);
};

/**
 * Detaches an event from this websocket
 * If no callback is provided all events are cleared of that type.
 * @param event {String} - Event to detach from
 * @param callback {Function} - the function you registered
 */
NativeWebSockets.prototype.off = function(event, callback) {
    this.removeEventListener(event, callback);
};

/**
 * Attach an event to this webSocket
 * @param event {String} - Event Type ("message", "open", "close", "error")
 * @param callback {Function} - the function to run on the event
 * @param thisArg {Object} - the "this" to use for calling your function, defaults to this current webSocket "this"
 */
NativeWebSockets.prototype.addEventListener = function(event, callback, thisArg) {
    if (!Array.isArray(this._callbacks[event])) {
        throw new Error("addEventListener passed an invalid event type " + event);
    }
    this._callbacks[event].push({c: callback, t: thisArg});
};

/**
 * Detaches an event from this webSocket
 * If no callback is provided all events are cleared of that type.
 * @param event {String} - Event to detach from
 * @param callback {Function} - the function you registered
 */
NativeWebSockets.prototype.removeEventListener = function(event, callback) {
    if (!Array.isArray(this._callbacks[event])) {
        throw new Error("Invalid event type in removeEventListener " + event);
    }
    if (callback) {
        var eventCallbacks = this._callbacks[event];
        for (var i=eventCallbacks.length-1;i>=0;i--) {
            if (eventCallbacks[i].c === callback) {
                eventCallbacks.slice(i, 1);
            }
        }
    } else {
        this._callbacks[event] = [];
    }

};

/**
 This opens or re-opens a webSocket.
 */
NativeWebSockets.prototype.open = function() {
    if (this._hasOpened) {
        // Browser WebSockets aren't allowed to re-open
        if (this._browser) {
            return;
        }
        if (this.state() >= 3) {
            this._socket.wrapper = null;
            this._socket = null;
            this._reCreate();
        } else {
            return;
        }
    }
    this._hasOpened = true;
    //noinspection JSUnresolvedFunction
    this._socket.connect();
};

/**
 * This closes your webSocket
 * @param code {Number} - The value to send as the close reason
 * @param message {String} - The message as to why you are closing
 */
NativeWebSockets.prototype.close = function(code, message) {
    if (arguments.length) {
       this._socket.close(code, message || "");
    } else {
       this._socket.close();
    }
};

/**
 * This sends a Text or Binary Message (Allows Buffering of messages if this is an advanced WebSocket)
 * @param message {string|Array|ArrayBuffer} - Message to send
 * @returns {boolean} - returns false if it is unable to send the message at this time, it will queue them up and try later...
 */
NativeWebSockets.prototype.send = function(message) {
    var state = this.state();

    // If we have a queue, we need to start processing it...
    if (this._queue.length && state === this.OPEN) {
        for (var i = 0; i < this._queue.length; i++) {
            this._send(this._queue[i]);
        }
        this._queue = [];
        if (this._queueRunner) {
            clearTimeout(this._queueRunner);
            this._queueRunner = null;
        }
    }

    // You shouldn't be sending null/undefined messages; but if you do -- we won't error out.
    if (message === null || message === undefined) {
        this._startQueueRunner();
        return false;
    }

    // If the socket isn't open, or we have a queue length; we are
    if (state !== this.OPEN || this._queue.length) {
        if (this._browser) {
            return false;
        }
        this._queue.push(message);
        this._startQueueRunner();
        return false;
    }

    this._send(message);
    return true;
};

/**
 * Internal function to start the Queue Runner timer
 * @private
 */
NativeWebSockets.prototype._startQueueRunner = function() {
    if (!this._queueRunner && this.state() !== this.OPEN && this._queue.length) {
        var self = this;
        this._queueRunner = setTimeout(function() {
            self._queueRunner = null;
            self.send(null);
        }, 250);
    }
};

/**
 * Internal function that actually sends the message
 * @param message {String|ArrayBuffer} - Message to send
 * @private
 */
NativeWebSockets.prototype._send = function(message) {
  if (message instanceof ArrayBuffer || message instanceof Uint8Array || Array.isArray(message)) {
      var view;
      if (message instanceof ArrayBuffer) {
         view = new Uint8Array(message);
      } else {
         view = message;
      }
      //noinspection JSUnresolvedFunction,JSUnresolvedVariable
      var buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.class.getField("TYPE").get(null), view.length);
      for (var i=0;i<view.length;i++) {
          //noinspection JSUnresolvedFunction,JSUnresolvedVariable
          java.lang.reflect.Array.setByte(buffer, i, byte(view[i]));
      }
      this._socket.send(buffer);
  } else {
      this._socket.send(message);
  }

};

/**
 * Returns the state of the Connection
 * @returns {Number} - returns this.NOT_YET_CONNECTED, .CONNECTING, .OPEN, .CLOSING or .CLOSED
 */
NativeWebSockets.prototype.state = function() {
    //noinspection JSUnresolvedFunction
    return this._socket.getState()-1;
};

/**
 * Is the connection open
 * @returns {boolean} - true if the connection is open
 */
NativeWebSockets.prototype.isOpen = function() {
    return this._socket.isOpen();
};

/**
 * Is the connection closed
 * @returns {boolean} - true if the connection is closed
 */
NativeWebSockets.prototype.isClosed = function() {
    return this._socket.isClosed();
};

/**
 * Is the connection is in the process of closing
 * @returns {boolean} - true if closing
 */
NativeWebSockets.prototype.isClosing = function() {
    return this._socket.isClosing();
};

/**
 * Is the connection currently connecting
 * @returns {boolean} - true if connecting
 */
NativeWebSockets.prototype.isConnecting = function() {
    return this._socket.isConnecting();
};

/**
 * Returns the Remote address
 * @returns {String} - the address
 */
NativeWebSockets.prototype.getRemoteSocketAddress = function() {
    return this._socket.getRemoteSocketAddress();
};

/**
 * This returns the current protocol
 */
Object.defineProperty(NativeWebSockets.prototype, "protocol", {
    get: function () {
        return this._protocol;
    },
    enumerable: true,
    configurable: true
});

/**
 * This returns the current readyState
 */
Object.defineProperty(NativeWebSockets.prototype, "readyState", {
    get: function () {
        var s = this.state();
        // No such -1 in the web spec
        if (s === -1) { return 0; }
        return s;
    },
    enumerable: true
});

/**
 * This returns the URL you connected too
 */
Object.defineProperty(NativeWebSockets.prototype, "url", {
    get: function () {
        return this._url;
    },
    enumerable: true
});

/**
 * This returns the amount of data buffered
 */
Object.defineProperty(NativeWebSockets.prototype, "bufferedAmount", {
    get: function () {
        // Technically I should return the actual amount of data; but as an optimization we are just returning the number of entries
        // as this will allow the developer to know there is still data in the queue.
        return this._queue.length;
    },
    enumerable: true
});

/**
 * This returns any extensions running.
 */
Object.defineProperty(NativeWebSockets.prototype, "extensions", {
    get: function () {
        return "";
    },
    enumerable: true
});

/**
 * This returns true because it is on the ANDROID platform
 */
Object.defineProperty(NativeWebSockets.prototype, "android", {
    get: function () {
        return true;
    },
    enumerable: true
});

/**
 * This is a list standardized Close Codes
 * @type {Number}
 */
NativeWebSockets.CLOSE_CODE = {NORMAL: 1000, GOING_AWAY: 1001, PROTOCOL_ERROR: 1002, REFUSE: 1003, NOCODE: 1005, ABNORMAL_CLOSE:1006, NO_UTF8: 1007, POLICY_VALIDATION: 1008, TOOBIG: 1009, EXTENSION: 1010, UNEXPECTED_CONDITION: 1011, TLS_ERROR: 1015, NEVER_CONNECTED: -1, BUGGYCLOSE: -2, FLASHPOLICY: -3};

/**
 * This is the NOT_YET_CONNECTED value
 * @type {number}
 */
NativeWebSockets.prototype.NOT_YET_CONNECTED = -1;

/**
 * This is the CONNECTING value
 * @type {number}
 */
NativeWebSockets.prototype.CONNECTING =  0;

/**
 * This is the OPEN value
 * @type {number}
 */
NativeWebSockets.prototype.OPEN = 1;

/**
 * This is the CLOSING value
 * @type {number}
 */
NativeWebSockets.prototype.CLOSING = 2;

/**
 * This is the CLOSED value
 * @type {number}
 */
NativeWebSockets.prototype.CLOSED = 3;

module.exports = NativeWebSockets;


