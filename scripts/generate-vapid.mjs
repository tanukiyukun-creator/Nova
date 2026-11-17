import webpush from 'web-push';
const keys=webpush.generateVAPIDKeys();
console.log('\nNOVA_VAPID_PUBLIC_KEY='+keys.publicKey);\nconsole.log('NOVA_VAPID_PRIVATE_KEY='+keys.privateKey);\nconsole.log('NOVA_VAPID_SUBJECT=mailto:admin@example.com\n');