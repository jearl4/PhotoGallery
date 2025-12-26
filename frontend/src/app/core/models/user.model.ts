export interface User {
  userId: string;
  email: string;
  name: string;
  provider: 'google' | 'facebook' | 'apple' | 'cognito';
  storageUsed: number;
  plan: 'free' | 'pro';
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}
