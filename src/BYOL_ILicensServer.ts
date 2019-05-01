/// <reference path="ref/tsd.d.ts" />

export enum LicensType { namedUser, enterprise }

export interface ILicenseCheckResult {
    hasValidLicens: boolean;
    isTrial: boolean;
    daysLeftOfTrial?: number;
    msg?: string;
}

export interface ILicensPool {
    poolId?: string;
    name?: string
    state: string;
    subscriptionId: string;
    owner: {id:string, 
            uniqueName: string, 
            displayName:string,
            imageUrl:string },
    customerId: string;
    licensType: string;
    planId: string;
    planName: string,
    planDescription:string
    purchasedQuantity: number;
}

export interface ILicensAssignment {
    assigned:boolean,
    poolId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
    imageUrl: string;
}

export interface IExtensionLicensData {
    id: string;
   
    licensPools: ILicensPool[];
    assignedUsers?: ILicensAssignment[];
    defaultBilling: {
        company :string;
        adr1: string;
        adr2: string;
        country: string;
        city: string;
        zip: string;
        vat: string;
    }

}

export interface IExtensionLicensServer {
    SetDefBilling(company: string, adr1: string, adr2: string, country: string, city: string, zip: string, vat: string);
    GetExtensionLicensData(): IPromise<IExtensionLicensData>;
    StoreLicensingData(data?: IExtensionLicensData): IPromise<boolean>;     
    AddLicensPool(pool: ILicensPool)
}