
export interface IPlanInfoTiers {
    start: number;
    stop: number;   
    price: number;
}

export interface IPlanInfo {
    id: string;
    name: string;
    description: string;
    price: number;
    period: number;
    periodUnit: string;
    pricingModel: string;
    chargeModel: string;
    currencyCode: string;
    tiers: IPlanInfoTiers[];
    priceTxt: string;
    licensType: string;
}

export interface ICustomer {

    customerId?: string;
    firstName: string;
    lastName: string;
    company: string;
    adr1?: string, 
    adr2?: string,
    country?: string, 
    city?:string,
    zip?:string
    email?: string;
    vat?: string;
}

enum SubStateEnum { active = "active", trial = "trial", cancelled ="cancelled" }

export interface ISubscriptionInfo {
    id: string;
    customer_id: string;
    plan_id: string;
    plan_quantity: number;
    state: SubStateEnum;
    trial_start: Date;
    trial_end: Date;
}


export interface IInvoice {
    id: string;
    date: Date;
    dueDate: Date;
    totalAmount: number;
    dueAmount: number;
    currencyCode: string;
    state: string;
    url: string;
}


export interface IMarketplaceService {
    GetSubscription(subscription: string): IPromise<ISubscriptionInfo>
    GetSubscriptionInvocies(subscriptionId: string): IPromise<IInvoice[]> 
    GetPlans(): IPromise<IPlanInfo[]>

    CreatSubscription(customer: ICustomer, cardToken: string, planId: string, quanity: number): IPromise<any> 
    UpdateSubscription(subscriptionId: string, planId: string, quanity: number): IPromise<any> 
    CancelSubscription(subscriptionId: string): IPromise<any> 
    StartTrial(customer: ICustomer): IPromise<any> 
}

