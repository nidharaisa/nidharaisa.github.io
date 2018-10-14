// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;


function onSuccess() {};
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

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }

  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

    /*
    navigator.getUserMedia = navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia;

    if(navigator.getUserMedia) {
        const constraints = { audio: false, video: true };
        navigator.getUserMedia(constraints, faceMask, streamErr);
    }
    else {
        console.log("Browser not supported!!!");
    }
*/
    
// getUserMedia modify
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true,
  }).then(stream => {
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;
      
    // face mask here
      faceMask(stream);

    // Add your stream to be sent to the conneting peer
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
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
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}


function faceMask(stream) {
    
    console.log("stream found!!!");

    var video = document.getElementById('localVideo');
    var canvas = document.getElementById('canvas');
    var context = canvas.getContext('2d');
    localVideo.srcObject = stream;

    // set tracker option
    var tracker = new tracking.ObjectTracker('face');
    tracker.setInitialScale(4);
    tracker.setStepSize(2);
    tracker.setEdgesDensity(0.1);

    tracking.track('#localVideo', tracker);

    tracker.on('track', function(event) {
        
        console.log("track successful!!!");
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        // context.drawImage(stream, 0, 0);

        event.data.forEach(function(rect) {
        context.strokeStyle = '#a64ceb'; 
        context.strokeRect(rect.x, rect.y, rect.width, rect.height);
        context.font = '11px Helvetica';
        context.fillStyle = "#f5f";
        // context.fillText('x: ' + rect.x + 'px', rect.x + rect.width + 5, rect.y + 11); // context.fillText('y: ' + rect.y + 'px', rect.x + rect.width + 5, rect.y + 22);
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        });
      });
}

function streamErr (err) {
    console.log("error occured");
}