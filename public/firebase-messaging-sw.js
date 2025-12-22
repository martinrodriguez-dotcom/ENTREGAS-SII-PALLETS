importScripts('[https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js](https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js)');
importScripts('[https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js](https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js)');

firebase.initializeApp({
  apiKey: "AIzaSyBF-7P8QhcOQb4KnlxacCDkY3-m1ETvhr0",
  authDomain: "entregas-sii-pallets.firebaseapp.com",
  projectId: "entregas-sii-pallets",
  storageBucket: "entregas-sii-pallets.firebasestorage.app",
  messagingSenderId: "42949067833",
  appId: "1:42949067833:web:37b0257a9e0b8c2a03e103"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
