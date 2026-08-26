export interface JwtPayload {
  sub: string;
  phoneNumber: string;
  role: 'customer' | 'shop_owner' | 'admin';
}
