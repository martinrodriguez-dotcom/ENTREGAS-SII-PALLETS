// Importar scripts necesarios de Firebase (versión compat para Service Workers)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Inicializar Firebase en el Service Worker con tus credenciales
firebase.initializeApp({
  apiKey: "AIzaSyBF-7P8QhcOQb4KnlxacCDkY3-m1ETvhr0",
  authDomain: "entregas-sii-pallets.firebaseapp.com",
  projectId: "entregas-sii-pallets",
  storageBucket: "entregas-sii-pallets.firebasestorage.app",
  messagingSenderId: "42949067833",
  appId: "1:42949067833:web:37b0257a9e0b8c2a03e103"
});

const messaging = firebase.messaging();

// Manejar mensajes recibidos cuando la app está en segundo plano (cerrada)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
  
  const notificationTitle = payload.notification.title || "Nueva Entrega SII";
  const notificationOptions = {
    body: payload.notification.body || "Hay una actualización en el sistema de cargas.",
    icon: '/logo192.png', // Asegúrate de tener este icono en la carpeta public
    badge: '/logo192.png',
    tag: 'entrega-notificacion', // Agrupa notificaciones similares
    data: {
      url: '/' // URL a abrir al tocar la notificación
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Al hacer clic en la notificación, abrir la aplicación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
