# Janus rtpforward plugin demo

A minimal working example of a browser frontend interfacing with the rtpforward plugin for Janus.


## How to run

The quick way: Run the demo virtual machine [vagrant_janus-rtpforward-plugin_demo](https://github.com/michaelfranzl/vagrant_janus-rtpforward-plugin_demo).

Alternatively, you can do all of the following steps manually:

Preconditions:

1. The echotest demo (browser app) shipped with Janus works.
2. Compile and install `janus-rtpforward-plugin` (see [README.md](../README.md)).
3. Janus listens at `localhost` or somewhere in your LAN with all open UDP ports so that there is no need for STUN/TURN servers.
4. The websocket server of Janus listens at ws://localhost:8188
5. Your browser supports ES8 Javascript and Import Maps. At the time of writing, only Chrome version 74 has experimental support for Import Maps. Until Import Maps are enabled by default, enable "Experimental Web Platform features" under `chrome://flags`.

In this (`demo`) sub-directory, run:

    npm ci
    npm install -g jspm@2.0.0-beta.7
    jspm install
    npm install -g http-server
    http-server

`http-server` will output a URL. Open it in your browser, e.g. `http://localhost:8080/`.

Give the browser access to your audio/video media. Then, open the browser's development console to look for potential errors or warnings.

After the rtpforward plugin receives media (after the "webrtcup" event), the command for a GStreamer pipeline will be output in the development console. Running this pipeline should display the video as ASCII art in your console.

## Development

`importmap.json` was generated with:

    jspm map ./src/index.js -o importmap.json --flat-scope --map-base .
