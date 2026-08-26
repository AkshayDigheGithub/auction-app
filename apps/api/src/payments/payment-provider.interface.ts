export interface ChargeCommissionInput {
  dealId: string;
  shopId: string;
  amount: number;
}

export interface ChargeCommissionResult {
  status: 'paid' | 'pending';
  reference?: string;
}

export interface PaymentProvider {
  chargeCommission(input: ChargeCommissionInput): Promise<ChargeCommissionResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
