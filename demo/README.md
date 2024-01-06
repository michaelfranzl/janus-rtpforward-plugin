# Janus rtpforward plugin demo

A minimal working example of a browser frontend interfacing with the rtpforward plugin for Janus.


## How to run

The quick way: Run the demo virtual machine [vagrant_janus-rtpforward-plugin_demo](https://github.com/michaelfranzl/vagrant_janus-rtpforward-plugin_demo).

Alternatively, you can do the following:

Preconditions:

1. There should be no NAT or firewall between your host and Janus so that there is no need for STUN/TURN servers.
2. The Websocket server of Janus listens at ws://localhost:8188 . If the URL is different, change
   it in `demo/src/index.js`.
3. The echotest demo (browser app) shipped with Janus works. This is to exclude potential problems
   with `janus-gateway` itself.
4. Compile and install `janus-rtpforward-plugin` (see [README.md](../README.md)).
5. Use a fairly recent web browser (current Mozilla Firefox or Google Chrome works).

Then install dependencies and start the web server:

```sh
npm ci
npm run dev
```

Open the URL displayed in the terminal.

Give the browser access to your audio/video media. Then, open the browser's development console to look for potential errors or warnings.

After the rtpforward plugin receives media (after the "webrtcup" event), the command for a GStreamer pipeline will be output in the development console. Running this pipeline should display the video as ASCII art in your console.
