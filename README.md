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
		
These packet loss simulations are perhaps too simple. They are no replacement for professional network simulation tools which also can generate jitter, packet reordering, packet corruption, etc.).

# Acknowledgements

Thanks go to mquander for the excellent "Simplest possible plugin for Janus". https://github.com/mquander/janus-helloworld-plugin


# Compiling and installing

````shell
	./bootstrap
	./configure --prefix=/opt/janus  # or wherever your janus install lives
	make
	make install  # installs into {prefix}/lib/janus/plugins
<!-- ```` -->
