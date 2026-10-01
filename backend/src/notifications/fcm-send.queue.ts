export const FCM_SEND_QUEUE = 'fcm-send';

export interface FcmSendJob {
  deviceTokenId: string;
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
