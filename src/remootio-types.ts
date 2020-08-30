export interface RemootioInterface {
  name: string;
  ipAddress: string;
  apiSecretKey: string;
  apiAuthKey: string;
}

export type RemootioDeviceType = Readonly<RemootioInterface>;
