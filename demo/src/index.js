/*
janus-rtpforward-plugin Demo
Copyright (C) 2018 Michael Franzl

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import 'webrtc-adapter';
import Session from 'minnie-janus/src/session-stamp.js';
import loglevel from 'loglevel';
import RtpforwardPlugin from './rtpforward-plugin.js';

loglevel.enableAll();

const session = Session({
  timeout_ms: 15000,
  log: loglevel,
});
window.session = session; // for direct access in console

const ws = new WebSocket('ws://localhost:8188', 'janus-protocol');

// Outgoing/incoming communications to/from Janus.
session.on('output', (msg) => ws.send(JSON.stringify(msg)));
ws.addEventListener('message', (event) => { session.receive(JSON.parse(event.data)); });

ws.addEventListener('open', async () => {
  loglevel.info('Creating session...');
  await session.create();
  loglevel.info(`Session with ID ${session.id} created.`);

  const rtpforwardPlugin = RtpforwardPlugin({ logger: loglevel });
  window.rtpforwardPlugin = rtpforwardPlugin; // for direct access in console

  loglevel.info('Attaching plugin...');
  await session.attachPlugin(rtpforwardPlugin);
  loglevel.info(`Rtpforward plugin attached with handle/ID ${rtpforwardPlugin.id}`);

  rtpforwardPlugin.receive = function receive(msg) {
    if (msg.janus === 'webrtcup') {
      loglevel.info('Will send a FIR packet to the browser every 5 seconds so that video decoders can start decoding.');
      setInterval(() => rtpforwardPlugin.fir(), 5000);

      loglevel.info('Janus is now receiving media from your browser and forwarding it via UDP to a target IP and port. Run the following GStreamer pipeline to view it:');

      loglevel.info(`
gst-launch-1.0 \
  rtpbin name=rtpbin \
  udpsrc address=${this.targetIP} port=${this.targetBasePort} caps="application/x-rtp, media=audio, encoding-name=OPUS, clock-rate=48000" ! rtpbin.recv_rtp_sink_0 \
  udpsrc address=${this.targetIP} port=${this.targetBasePort + 1} caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_0 \
  udpsrc address=${this.targetIP} port=${this.targetBasePort + 2} caps="application/x-rtp, media=video, encoding-name=VP8, clock-rate=90000" ! rtpbin.recv_rtp_sink_1 \
  udpsrc address=${this.targetIP} port=${this.targetBasePort + 3} caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_1 \
  rtpbin. ! rtpvp8depay ! vp8dec ! aasink \
    rtpbin. ! rtpopusdepay ! queue ! opusdec ! fakesink
      `);

      loglevel.info('If that doesn\'t work, try a simpler video-only pipeline:');

      loglevel.info(`
gst-launch-1.0 -v -e udpsrc address=${this.targetIP} port=${this.targetBasePort + 2} caps="application/x-rtp, media=video, encoding-name=VP8, clock-rate=90000" ! rtpvp8depay ! vp8dec ! videoconvert ! aasink
      `);

      loglevel.info('If you don\'t have GStreamer yet, install the following system packages: gstreamer1.0-tools gstreamer1.0-plugins-bad gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-ugly');
    }
  };
});

ws.addEventListener('close', () => {
  loglevel.warn('janus-gateway went away');
  session.stop();
});
