/* eslint-disable import/extensions */

import BasePlugin from 'minnie-janus/src/base-plugin-stamp.js';

/**
 * @module
 */

/**
 * @lends RtpforwardPlugin
 */
const properties = {
  name: 'janus.plugin.rtpforward', // must match the plugin name string in C
  rtcconn: null,
  vid_local: document.createElement('video'),
};

/**
 * @lends RtpforwardPlugin.prototype
 */
const methods = {
  /**
   * Receive an asynchronous ('pushed') message sent by the Janus core.
   *
   * @public
   * @override
   */
  receive(msg) {
    this.logger.info('Received message from Janus', msg);
  },

  /**
   * Send to the browser a Picture Loss Indication packet (PLI).
   *
   * Depending on the browser implementation, this should trigger a key frame from which a video
   * decoder can start decoding.
   *
   * @public
   */
  pli() {
    this.sendMessage({ request: 'pli' });
  },

  /**
   * Send to the browser a Full Intraframe request packet (FIR).
   *
   * Depending on the browser implementation, this should trigger a key frame from which a video
   * decoder can start decoding.
   *
   * @public
   */
  fir() {
    this.sendMessage({ request: 'fir' });
  },

  /**
   * Send to the browser a Receiver Estimated Maximum Bitrate packet (REMB).
   *
   * Depending on the browser implementation, this should cause the media stream to be encoded to
   * this maximum bitrate.
   *
   * @public
   * @param {Number} bitrate - bits per second
   */
  bitrate(bitrate) {
    this.sendMessage({
      request: 'remb',
      bitrate,
    });
  },

  /**
   * @private
   */
  async configure() {
    this.sendMessage({
      request: 'configure',

      // required
      sendipv4: this.targetIP,
      sendport_audio_rtp: this.targetBasePort + 0,
      sendport_audio_rtcp: this.targetBasePort + 1,
      sendport_video_rtp: this.targetBasePort + 2,
      sendport_video_rtcp: this.targetBasePort + 3,

      // optional
      negotiate_acodec: 'opus',
      negotiate_vcodec: 'vp8',
    });
  },

  /**
   * Set up a bi-directional WebRTC connection:
   *
   * 1. get local media
   * 2. create and send a SDP offer
   * 3. receive a SDP answer and add it to the RTCPeerConnection
   * 4. negotiate ICE (can happen concurrently with the SDP exchange)
   * 5. Play the video via the `onaddstream` event of RTCPeerConnection
   *
   * @private
   * @override
   */
  async onAttached() {
    this.logger.info('Asking user to share media. Please wait...');
    const localmedia = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    this.logger.info('Got local user media.');

    this.logger.info('Playing local user media in video element.');
    this.vid_local.srcObject = localmedia;
    this.vid_local.play();

    this.logger.info('Adding local user media to RTCPeerConnection.');
    this.rtcconn.addStream(localmedia);

    this.logger.info('Creating SDP offer. Please wait...');
    const jsepOffer = await this.rtcconn.createOffer({
      audio: true,
      video: true,
    });
    this.logger.info('SDP offer created.');

    this.logger.info('Setting SDP offer on RTCPeerConnection');
    this.rtcconn.setLocalDescription(jsepOffer);

    this.logger.info('Configuring plugin...');
    this.configure();

    this.logger.info('Getting SDP answer from Janus to our SDP offer. Please wait...');
    const { jsep: jsepAnswer } = await this.sendJsep(jsepOffer);
    this.logger.debug('Received SDP answer from Janus.');

    this.logger.debug('Setting the SDP answer on RTCPeerConnection. The `onaddstream` event will fire soon.');
    this.rtcconn.setRemoteDescription(jsepAnswer);
  },
};

/**
 * @constructs RtpforwardPlugin
 *
 * @classdesc
 *
 * @param {Object} options
 * @param {String} [options.ip='127.0.0.1'] - The IP to send the RTP packets to
 * @param {Number} [options.port=60000] - The start port of the four used ports:
 *   port+0: audio RTP
 *   port+1: audio RTCP
 *   port+2: video RTP
 *   port+3: video RTCP
 */
function init({ ip = '127.0.0.1', port = 60000 }) {
  this.rtcconn = new RTCPeerConnection();
  this.rtcconn.onicecandidate = async (event) => { this.sendTrickle(event.candidate || null); };

  this.vid_local.width = 320;
  this.vid_local.controls = false;
  this.vid_local.muted = true;

  this.targetIP = ip;
  this.targetBasePort = port;

  document.body.appendChild(this.vid_local);
}


const factory = BasePlugin.compose({
  methods,
  properties,
  initializers: [init],
});

export default factory;
