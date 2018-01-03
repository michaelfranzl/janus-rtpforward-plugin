# Janus rtpforward plugin

This plugin receives RTP and RTCP packets from a WebRTC connection (Janus Session) and forwards/sends them to UDP ports for further processing or display by an external receiver/decoder, e.g. a GStreamer pipeline.
 
Four destination UDP addresses/ports are used:
 
1. Audio RTP
2. Audio RTCP
3. Video RTP
4. Video RTCP

There are no config files. All ports/addresses can be configured via the plugin API before a WebRTC session is set up. To configure the plugin, send the following JSON to the plugin:

		"request": "configure",
		"sendipv4": "127.0.0.1",
		"sendport_audio_rtp": 60000,
		"sendport_audio_rtcp": 60001,
		"sendport_video_rtp": 60002,
		"sendport_video_rtcp": 60003
		
For now, only IPv4 addresses are supported.

To send to the browser a Picture Loss Indication packet (PLI), send the following API request:
		
		"request": "pli"
		
To send to the browser a Full Intraframe request packet (FIR), send the following API request:
		
		"request": "fir"
		
To send to the browser a Receiver Estimated Maximum Bitrate packet (REMB), send the following API request (note that depending on the video codec used, Firefox can currently go only as low as 200000, and Chrome can go as low as 50000):
		
		"request": "bitrate",
		"bitrate": <integer in bits per second>

To experiment how a RTP/RTCP receiver can tolerate packet loss, there are three API requests:

`drop_probability` configures the random drop of a number of packages in parts per 1000:

		"request": "drop_probability",
		"drop_permille": <integer between 0 and 1000>
		
`drop_video_packets` tells the plugin to drop the given number of next video RTP packets, then resume normal forwarding:
		
		"request": "drop_video_packets",
		"num": <integer>
		
`drop_audio_packets` tells the plugin to drop the given number of next audio RTP packets, then resume normal forwarding:
		
		"request": "drop_audio_packets",
		"num": <integer>
		
These packet loss simulations are perhaps too simple. They are no replacement for professional network simulation tools which also can generate jitter, packet reordering, packet corruption, etc.

# Limitations

This plugin only accepts VP8 and OPUS in RECVONLY mode. This is hardcoded via arguments to the `janus_sdp_generate_answer()` function, but can be changed easily (see comments there).

# GStreamer example

The following example GStreamer pipeline will output the WebRTC audio and video emitted by this plugin, if the port numbers, the payload numbers, and encoding names match. The payload numbers are negotiated dynamically in the SDP exchange, and may differ from browser to browser, and even from session to session. You need to inspect the SDP to find them.

You probably also need to send a PLI to the browser to request a keyframe. The pipeline starts displaying only after a keyframe has been received.

````shell
gst-launch-1.0 -v rtpbin name=rtpbin latency=50 \
  udpsrc port=60000 caps="application/x-rtp, media=audio, payload=111, encoding-name=OPUS, clock-rate=48000" ! rtpbin.recv_rtp_sink_0 \
  udpsrc port=60001 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_0 \
  udpsrc port=60002 caps="application/x-rtp, media=video, payload=96, encoding-name=VP8, clock-rate=90000" ! rtpbin.recv_rtp_sink_1 \
  udpsrc port=60003 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_1 \
  rtpbin. ! rtpvp8depay ! vp8dec ! autovideosink \
  rtpbin. ! rtpopusdepay ! queue ! opusdec ! pulsesink
```

# Acknowledgements

Thanks go to mquander for the excellent "Simplest possible plugin for Janus". https://github.com/mquander/janus-helloworld-plugin


# Compiling and installing

````shell
./bootstrap
./configure --prefix=/opt/janus  # or wherever your janus install lives
make
make install  # installs into {prefix}/lib/janus/plugins
````
