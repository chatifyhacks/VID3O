// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1); // Room ID

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('2xmbUiTsqTzukyf7');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;

$(document).ready(function() {
  // Display room ID to user
  $("#meetingid").html(roomHash);
  $("#chat").attr("src", "/chat#" + roomHash)
});

function onSuccess() { };
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // We're connected to the room and received an array of 'members'
  // connected to the room (including us). Signaling server is ready.
  room.on('members', members => {
    console.log('MEMBERS', members);
    // If we are the second user to connect to the room we will be creating the offer
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

let videostream = navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true,
});


function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({ 'candidate': event.candidate });
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }

  // When a remote stream arrives display it in the #remoteVideo element
  pc.onaddstream = event => {
    remoteVideo.srcObject = event.stream;
  };

  videostream.then(stream => {
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;
    // Add your stream to be sent to the conneting peer
    pc.addStream(stream);
  }, onError);

  // Listen to signaling data from Scaledrone
  room.on('data', (message, client) => {
    // Message was sent by us
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // When receiving an offer lets answer it
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      // Add the new ICE candidate to our connections remote description
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({ 'sdp': pc.localDescription }),
    onError
  );
}

audioSetting = true;
videoSetting = true;

function mediaSwitch() {
  navigator.mediaDevices.getUserMedia({
    audio: audioSetting,
    video: videoSetting,
  }).then(stream => {
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;
    // Add your stream to be sent to the conneting peer
    pc.addStream(stream);
  }, onError);
}

function showControls() {
  $("#controls").fadeIn(100);
}

async function hideControls() {
  await new Promise(r => setTimeout(r, 2000));
  $("#controls").fadeOut(100)
}

var mic = true;
var cam = true;

function toggleMic() {
  if (mic == true) { // turns off if it is already on
    mic = false;
    updateStream();
    console.log("mic off");
    $("#mic_icon").html("mic_off");
  } else { // turns on if it is already off
    mic = true;
    updateStream();
    console.log("mic on");
    $("#mic_icon").html("mic");
  }
}

function toggleCam() {
  if (cam == true) { // turns off if it is already on
    cam = false;
    updateStream();
    console.log("cam off");
    $("#cam_icon").html("videocam_off");
  } 
  else { // turns on if it is already off
    cam = true;
    updateStream();
    console.log("cam on");
    $("#cam_icon").html("videocam");
  }
}

function updateStream() {
  videostream.then(stream => {
    let sender = pc.getSenders();
    stream.getTracks().forEach( track => {
      console.log(track)
      if (track.kind === "audio") {
        track.enabled = mic;
        sender[0].replaceTrack(track);
      }
      if (track.kind === "video") {
        track.enabled = cam;
        sender[1].replaceTrack(track);
      }
    })
    console.log(stream.getTracks())
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;
    // Add your stream to be sent to the conneting peer
  }, onError);
}

function endCall() {
  window.location.href = "/";
}

// Copy current session link to clipboard
function copyLink() {
  let dummy = document.createElement('input'),
    text = window.location.href;
  document.body.appendChild(dummy);
  dummy.value = text;
  dummy.select();
  document.execCommand('copy');
  document.body.removeChild(dummy);
}

var screenshare = false;
let mirrored = true;

function toggleScreenshare() {
  if (screenshare == false) { // turns on if it is already off
    screenshare = true;
    screenShare();
    updateStream();
    toggleMirror();
    console.log("screenshare on");
    $("#screenshare_icon").html("stop_screen_share");
  } else { // turns off if it is already on
    screenshare = false;
    // Stopping screenshare should start webcam (if not disabled)
    webCam();
    updateStream();
    toggleMirror();
    console.log("screenshare off");
    $("#screenshare_icon").html("screen_share");
  }
}

function screenShare() {
   videostream = navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: 'motion',
      displaySurface: 'monitor'
    }
  });
}

function webCam() {
  videostream = navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
}

function toggleMirror() {
  console.log(mirrored);
  let localVideo = document.getElementById("localVideo")
  if (mirrored) {
    localVideo.classList.remove('mirror');
    mirrored = false;
  } else {
    localVideo.classList.add('mirror');
    mirrored = true;
  }
}

let modalBtn = document.getElementById("modal-btn")
let modal = document.querySelector(".modal")
let closeBtn = document.querySelector(".close-btn")
modalBtn.onclick = function(){
  modal.style.display = "block"
}
closeBtn.onclick = function(){
  modal.style.display = "none"
}
document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.keyCode == 27) {
        modal.style.display = "none"
    }
};
window.onclick = function(e){
  if(e.target == modal){
    modal.style.display = "none"
  }
}
document.addEventListener('keydown', function(event) {
  if (event.ctrlKey && event.key === 'c') {
    modal.style.display = "block"
  }
});

const input = document.querySelector("input");
const title = document.querySelector("title");
input.addEventListener("change", e => {
  title.innerText = input.value;
  document.getElementById('meetingname').value='';
});