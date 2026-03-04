const peers = {}; // socketId -> RTCPeerConnection
let localStream = null;
let socket = null;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export const initWebRTC = (sock, onStreamAdded) => {
    socket = sock;

    socket.off('webrtc_offer');
    socket.off('webrtc_answer');
    socket.off('webrtc_ice_candidate');
    socket.off('player_disconnected');

    socket.on('webrtc_offer', async ({ offer, senderId }) => {
        const pc = createPeerConnection(senderId, onStreamAdded);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { answer, targetId: senderId });
    });

    socket.on('webrtc_answer', async ({ answer, senderId }) => {
        const pc = peers[senderId];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    socket.on('webrtc_ice_candidate', async ({ candidate, senderId }) => {
        const pc = peers[senderId];
        if (pc && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    socket.on('player_disconnected', ({ id }) => {
        closePeer(id);
    });
};

const createPeerConnection = (targetId, onStreamAdded) => {
    const pc = new RTCPeerConnection(configuration);
    peers[targetId] = pc;

    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', { targetId, candidate: event.candidate });
        }
    };

    pc.ontrack = (event) => {
        if (onStreamAdded) {
            onStreamAdded(targetId, event.streams[0]);
        }
    };

    return pc;
};

export const startLocalStream = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        return true;
    } catch (e) {
        console.error('Failed to get local stream', e);
        return false;
    }
};

export const stopLocalStream = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    Object.keys(peers).forEach(id => closePeer(id));
};

export const toggleMute = (mute) => {
    if (localStream) {
        localStream.getAudioTracks().forEach(t => t.enabled = !mute);
    }
};

export const connectToPeers = async (peerIds, onStreamAdded) => {
    for (const id of peerIds) {
        if (id === socket.id || peers[id]) continue;
        const pc = createPeerConnection(id, onStreamAdded);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', { targetId: id, offer });
    }
};

const closePeer = (id) => {
    if (peers[id]) {
        peers[id].close();
        delete peers[id];
    }
};
