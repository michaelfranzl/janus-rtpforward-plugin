# Janus rtpforward plugin

This plugin for the [Janus WebRTC gateway](https://github.com/meetecho/janus-gateway) takes RTP and RTCP packets from a WebRTC connection (Janus Session) and forwards/sends them to UDP ports for further processing or display by an external receiver/decoder (e.g. a GStreamer pipeline). UDP broadcast and multicast is implicitly supported by setting the `sendipv4` to broadcast or multicast IP addresses.

Four destination UDP addresses/ports are used:
 
1. Audio RTP
2. Audio RTCP
3. Video RTP
4. Video RTCP

There are no configuration files. All ports/addresses can be configured via the plugin API on a per-session basis. To configure a plugin session, send the following JSON:

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
		
To send to the browser a Receiver Estimated Maximum Bitrate packet (REMB), send the following API request (note that depending on the video codec used, Firefox can currently go only as low as 200000, whereas Chrome can go as low as 50000):
		
		"request": "remb",
		"bitrate": <integer in bits per second>

To experiment how a RTP/RTCP receiver can tolerate packet loss, there are three API requests:

`drop_probability` configures the uniformly random drop of a number of packages in parts per 1000:

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


# Use cases

Note: The following two use cases use the UDP multicast IP address 225.0.0.37 (which is in a group of multicast addresses not routed, i.e. only working on the same machine). This enables multiple subscribers to the same RTP stream, for maximum flexibility.

## GStreamer display

The following example GStreamer pipeline will output the WebRTC audio and video emitted by this plugin (if the port numbers, the payload numbers, and encoding names match). The payload numbers are negotiated dynamically in the SDP exchange, and may differ from browser to browser, and even from session to session. You need to inspect each SDP exchange to find them on a per-session basis. Such a pipeline is thus best launched programmatically.

You probably also need to send a PLI to the browser to request a keyframe if the GStreamer pipeline is launched mid-stream. The following pipeline will start running only after a keyframe has been received.

Hardware clocks of low-end consumer audio and video electronics (e.g. USB webcam, USB headset) may drift up to 1 second per 24 hours. To compensate, this pipeline uses one `rtpbin` element, which synchronizes audio and video ("lip-sync") according to timestamps in all RTP and RTCP packets.

Note that you can lauch the same pipeline several times when you're multicasting.

````shell
gst-launch-1.0 -v \
rtpbin name=rtpbin latency=100 \
udpsrc address=225.0.0.37 auto-multicast=true port=60000 caps="application/x-rtp, media=audio, payload=111, encoding-name=OPUS, clock-rate=48000" ! rtpbin.recv_rtp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true port=60001 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true port=60002 caps="application/x-rtp, media=video, payload=96, encoding-name=VP8, clock-rate=90000" ! rtpbin.recv_rtp_sink_1 \
udpsrc address=225.0.0.37 auto-multicast=true port=60003 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_1 \
rtpbin. ! rtpvp8depay ! vp8dec ! autovideosink \
rtpbin. ! rtpopusdepay ! queue ! opusdec ! pulsesink
````


## GStreamer dumping to file

The following GStreamer pipeline simply dumps the synchronized (by `rtpbin`) and already compressed media (by the client browser, conveniently!) into a Matroska container (note that the video will only start after a keyframe):


````shell
gst-launch-1.0 -v -e \
matroskamux name=mux streamable=1 ! filesink location=/tmp/dump.mkv \
rtpbin name=rtpbin latency=100 \
udpsrc address=225.0.0.37 auto-multicast=true port=60000 caps="application/x-rtp, media=audio, payload=111, encoding-name=OPUS, clock-rate=48000" ! rtpbin.recv_rtp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true port=60001 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true port=60002 caps="application/x-rtp, media=video, payload=96, encoding-name=VP8, clock-rate=90000" ! rtpbin.recv_rtp_sink_1 \
udpsrc address=225.0.0.37 auto-multicast=true port=60003 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_1 \
rtpbin. ! rtpopusdepay ! mux.audio_0 \
rtpbin. ! rtpvp8depay ! mux.video_0
````


## Combining janus-rtpforward-plugin and janus-streaming-plugin

Combining this plugin with the janus-streaming plugin (supplied with Janus) allows a novel implementation of an echo test and opens up interesting possibilities for other use-cases. If you configure one rtpforward session like so...

		"request": "configure",
		"sendipv4": "225.0.0.37",
		"sendport_audio_rtp": 60000,
		"sendport_audio_rtcp": 60001,
		"sendport_video_rtp": 60002,
		"sendport_video_rtcp": 60003

... and then configure the janus-streaming plugin like so (in its configuration file) ...

````
[multicast-from-janus-rtpforward-plugin]
type = rtp
id = 1
description = Opus/VP8 live multicast stream coming from janus-rtpforward-plugin 
audio = yes
video = yes
audioport = 60000
audiomcast = 225.0.0.37
audiopt = 111
audiortpmap = opus/48000/2
videoport = 60002
videomcast = 225.0.0.37
videopt = 100
videortpmap = VP8/90000
````

... then all subscribers to this mountpoint (id=1) will receive realtime A/V from the first rtpforward session.


# Acknowledgements

Thanks go to the authors of [janus-gateway](https://github.com/meetecho/janus-gateway) and mquander for the excellent "Simplest possible plugin for Janus" ([janus-helloworld-plugin](https://github.com/mquander/janus-helloworld-plugin)).


# Compiling and installing

````shell
./bootstrap
./configure --prefix=/opt/janus  # or wherever your janus install lives
make
make install  # installs into {prefix}/lib/janus/plugins
````
