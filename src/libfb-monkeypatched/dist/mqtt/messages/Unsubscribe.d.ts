import MqttMessage from '../MqttMessage';
/**
 * Assembles a subscribe message sent just after mqtt connection that subscribes to given topics.
 */
export declare const encodeUnsubscribe: (msgId: number) => MqttMessage;