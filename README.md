# Janus rtpforward plugin

This plugin for the [Janus WebRTC gateway](https://github.com/meetecho/janus-gateway) (tested with revision dc81819 [2017-12-04]) takes RTP and RTCP packets from a WebRTC connection (Janus Session) and forwards/sends them to UDP ports for further processing or display by an external receiver/decoder (e.g. a GStreamer pipeline).

Four destination UDP addresses/ports are used:
 
1. Audio RTP
2. Audio RTCP
3. Video RTP
4. Video RTCP

## API

There are no configuration files. All ports/addresses can be configured via the plugin API on a per-session basis. To configure a plugin session, send the following payload (ideally before the first WebRTC RTP packet comes in, but can be later than that):

		"request": "configure",
		"sendipv4": "127.0.0.1",
		"sendport_audio_rtp": 60000,
		"sendport_audio_rtcp": 60001,
		"sendport_video_rtp": 60002,
		"sendport_video_rtcp": 60003
		
For now, only IPv4 addresses are supported.

To send to the browser a Picture Loss Indication packet (PLI), send the following payload:
		
		"request": "pli"
		
To send to the browser a Full Intraframe request packet (FIR), send the following payload:
		
		"request": "fir"
		
To send to the browser a Receiver Estimated Maximum Bitrate packet (REMB), send the following payload (note that depending on the video codec used, Firefox can currently go only as low as 200000, whereas Chrome can go as low as 50000):
		
		"request": "remb",
		"bitrate": <integer in bits per second>

To enable or disable forwarding of audio packets, send the following payload:

		"audio_enabled": true|false

To enable or disable forwarding of video packets, send the following payload:

		"video_enabled": true|false

To auto-enable video forwarding at the next keyframe, send the following payload:

		"enable_video_on_keyframe": true

### Packet loss simulation

To experiment how a downstream RTP/RTCP receiver can tolerate packet loss, there are three API requests:

`drop_probability` configures the uniformly random drop of a number of packages in parts per 1000:

		"drop_probability": <integer between 0 and 1000>

`drop_video_packets` tells the plugin to drop the given number of next video RTP packets, then resume normal forwarding:

		"drop_video_packets": <integer>

`drop_audio_packets` tells the plugin to drop the given number of next audio RTP packets, then resume normal forwarding:

		"drop_audio_packets": <integer>

These packet loss simulations are very simple and do not reflect real networks, but they may be useful for debugging.


# Limitations

This plugin only accepts VP8 and OPUS in RECVONLY mode. This is hardcoded via arguments to the `janus_sdp_generate_answer()` function, but can be changed easily (see comments there).


# UDP broadcast/multicast

UDP broadcast and multicast is implicitly supported by configuring the `sendipv4` to broadcast or multicast IP addresses (strictly speaking, this is just a feature of the socket or OS, not a feature of this plugin). If a multicast IP address is detected, as a security precaution, the plugin will set the `IP_MULTICAST_TTL` option of the sending socket to 0 (zero) which SHOULD cause at least the first router (the Linux kernel) to NOT forward the UDP packets to any other network (the packets SHOULD be accessible only on the same machine). This behavior is however OS-specific. **When configuring a multicast IP address, you SHOULD verify that the UDP packets are not inadvertenly forwarded into networks where the security/privacy of the packets could be compromised, or into networks where congestion or bandwidth need to be observed. In the worst case, the UDP packets could be forwarded to large sections of the internet. As a last resort, you should configure your firewall to drop the packets. If in doubt, do NOT configure this plugin with multicast IP addresses! It is safest to simply use 127.0.0.1.**

In addition, if a multicast IP address is detected, the plugin will set the network interface to be used to the software loopback interface (via the `INADDR_LOOPBACK` constant, which should be "127.0.0.1") for lowest latency. If we don't do this, then the OS may choose a network interface for us, and a physical ethernet card could add latency. UDP multicast receivers may have to set the interface to the same (in below GStreamer examples, this is achieved via the `multicast-iface=lo` option to `udpsrc`).


# Use cases

Note: The following two use cases use the UDP multicast IP address 225.0.0.37. This enables multiple subscribers to the same RTP stream, for maximum flexibility.

## GStreamer display

The following example GStreamer pipeline will output the WebRTC audio and video emitted by this plugin (if the port numbers, the payload numbers, and encoding names match). The payload numbers are negotiated dynamically in the SDP exchange, and may differ from browser to browser, and even from session to session. You need to inspect each SDP exchange to find them on a per-session basis. Such a pipeline is thus best launched programmatically.

You probably also need to send a PLI to the browser to request a keyframe if the GStreamer pipeline is launched mid-stream. The following pipeline will start running only after a keyframe has been received.

Hardware clocks of low-end consumer audio and video electronics (e.g. USB webcam, USB headset) may drift up to 1 second per 24 hours. To compensate, this pipeline uses one `rtpbin` element, which synchronizes audio and video ("lip-sync") according to timestamps in all RTP and RTCP packets.

Note that you can lauch the same pipeline several times when you're multicasting.

````shell
gst-launch-1.0 -v \
rtpbin name=rtpbin latency=100 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60000 caps="application/x-rtp, media=audio, payload=111, encoding-name=OPUS, clock-rate=48000" ! rtpbin.recv_rtp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60001 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60002 caps="application/x-rtp, media=video, payload=96, encoding-name=VP8, clock-rate=90000" ! rtpbin.recv_rtp_sink_1 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60003 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_1 \
rtpbin. ! rtpvp8depay ! vp8dec ! autovideosink \
rtpbin. ! rtpopusdepay ! queue ! opusdec ! pulsesink
````


## GStreamer dumping to file

The following GStreamer pipeline simply dumps the synchronized (by `rtpbin`) and already compressed media (by the client browser, conveniently!) into a Matroska container (note that the video will only start after a keyframe):


````shell
gst-launch-1.0 -v -e \
matroskamux name=mux streamable=1 ! filesink location=/tmp/dump.mkv \
rtpbin name=rtpbin latency=100 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60000 caps="application/x-rtp, media=audio, payload=111, encoding-name=OPUS, clock-rate=48000" ! rtpbin.recv_rtp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60001 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_0 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60002 caps="application/x-rtp, media=video, payload=96, encoding-name=VP8, clock-rate=90000" ! rtpbin.recv_rtp_sink_1 \
udpsrc address=225.0.0.37 auto-multicast=true multicast-iface=lo port=60003 caps="application/x-rtcp" ! rtpbin.recv_rtcp_sink_1 \
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
