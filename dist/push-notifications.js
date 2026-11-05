import {flightRequest} from './cloud-v2.js?v=9';
export async function enablePush(){if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Este navegador não oferece notificações. No iPhone, instale o AeroPing na tela inicial e abra por lá.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Notificações não autorizadas. Os pings continuam na central.');
 const registration=await navigator.serviceWorker.ready;const {publicKey}=await flightRequest({mode:'push-key'});if(!publicKey)throw Error('As notificações ainda não estão disponíveis.');
 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});await flightRequest({mode:'push-register',subscription:subscription.toJSON()});
}
export async function disablePush(){if(!('serviceWorker'in navigator)||!('PushManager'in window))return;const registration=await navigator.serviceWorker.getRegistration();const subscription=await registration?.pushManager.getSubscription();if(!subscription)return;try{await flightRequest({mode:'push-remove',endpoint:subscription.endpoint});}finally{await subscription.unsubscribe();}}
