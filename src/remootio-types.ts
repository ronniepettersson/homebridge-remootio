export interface RemootioInterface {
  name: string;
  ipAddress: string;
  apiSecretKey: string;
  apiAuthKey: string;
  freeRelayOutput?: boolean;
  secondaryName?: string;
}

export type RemootioDeviceType = Readonly<RemootioInterface>;
