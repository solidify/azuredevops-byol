import { defer } from "q";
import * as ILicensServer from "./BYOL_ILicensServer"

import * as IMarketplaceServer from "./BYOL_IMarketplaceServer"



export interface ILicenseCheckResult {
    hasValidLicens: boolean;
    isTrial: boolean;
    daysLeftOfTrial?: number;
    msg?: string;
}



interface ISubscriptionPayLoad {
    subscription: ISubscriptionInfo;
}

enum SubStateEnum { active = "active", trial = "in_trial", cancelled = "cancelled" }


export interface ISubscriptionInfo {
    id: string;
    customer_id: string;
    plan_id: string;
    plan_quantity: number;
    state: SubStateEnum
    trial_start: Date;
    trial_end: Date;
}



export class ExtDataLicensServer implements ILicensServer.IExtensionLicensServer {

    private static licenseClient: ExtDataLicensServer;
    protected licenseData: ILicensServer.IExtensionLicensData;
    protected marketPlaceServer: IMarketplaceServer.IMarketplaceService;
    public static getClient(marketPlaceServer: IMarketplaceServer.IMarketplaceService): ExtDataLicensServer {
        
        if (!ExtDataLicensServer.licenseClient) {
            ExtDataLicensServer.licenseClient = new ExtDataLicensServer();
            ExtDataLicensServer.licenseClient.marketPlaceServer = marketPlaceServer;

        }

        return ExtDataLicensServer.licenseClient;
    }

    public isLicensed(): IPromise<ILicenseCheckResult> {
        var deferred = $.Deferred<ILicenseCheckResult>();
        var self = this;
        var t0 = performance.now();
        self.GetExtensionLicensData().then(licenseData => {
            console.log("GetExtensionLicensData DONE" + (performance.now() - t0), licenseData);

            var entLic = self.licenseData.licensPools.filter(i => { return i.licensType == "Enterprise" })
            if (entLic.length > 0) {
                console.log("Found enterprise licenses", entLic)
                entLic.forEach(l => {
                    var t1 = performance.now();
                    self.marketPlaceServer.GetSubscription(l.subscriptionId).then(subData => {
                        console.log("marketPlaceServer.GetSubscription DONE " + (performance.now() - t1), subData);
                        var r = self.CreateLicenseCheckResult(subData);
                        deferred.resolve(r);
                    })
                });
            }
            else {
                var user = VSS.getWebContext().user.id;
                console.log("NamedUser licensing, looking for=", user);
                var userLic = self.licenseData.assignedUsers.filter(i => { return i.userId== user && i.assigned==true; });
                if (userLic.length > 0) {
                    var t1 = performance.now();
                    self.marketPlaceServer.GetSubscription(self.getSubscriptionIdforPool(userLic[0].poolId)).then(subData => {
                        console.log("marketPlaceServer.GetSubscription DONE " + (performance.now() - t1), subData);
                        var r = self.CreateLicenseCheckResult(subData);
                        deferred.resolve(r);
                    });
                }
                else {
                    var r: ILicenseCheckResult = { hasValidLicens: false, isTrial: false };
                    r.msg = "Neither Enterprise nor assigned named license found";
                    deferred.resolve(r);
                }

            }
        },
            err => {
                //NO licensing data ?
                var r: ILicenseCheckResult = { hasValidLicens: false, isTrial: false };
                r.msg = "Neither Enterprise nor assigned named license found";
                deferred.resolve(r);

            });

        return deferred.promise();
    }

    public getSubscriptionIdforPool(poolId: string): string {
        var pool = this.licenseData.licensPools.filter(i => { return i.poolId == poolId });
        if (pool.length > 0) {
            return pool[0].subscriptionId;
        }
        return null;
    }

    protected CreateLicenseCheckResult(sub: ISubscriptionInfo): ILicenseCheckResult {
        
        var i: ILicenseCheckResult = { hasValidLicens: false, isTrial: false };

        if (sub != null) {
            var hasValidLicens = (sub.state == SubStateEnum.active || sub.state == SubStateEnum.trial)

            var isTrial = sub.state == SubStateEnum.trial;

            i= { hasValidLicens: hasValidLicens, isTrial: isTrial };
            if (i.isTrial) {
                i.daysLeftOfTrial = 1;//TODO  sub.trial_end
            }

        }
        console.log("CreateLicensCheckResult=", i)
        return i;
    }

    public GetExtensionLicensData(): IPromise<ILicensServer.IExtensionLicensData> {
        var deferred = $.Deferred<ILicensServer.IExtensionLicensData>();
        /* TESTDATA ENTERPRISE 
        this.licenseData = {
            id: "42",
            licensPools: [{ licensType: "Enterprise", subscriptionId: "HngTot7R9eVBudOnw", ownerEmail:"mattias.skold@mskold.com", customerId:"" }]
        };
        */
        //window.crypto.subtle.generateKey(
        //    {
        //        name: "RSASSA-PKCS1-v1_5",
        //        modulusLength: 4096,
        //        publicExponent: new Uint8Array([1, 0, 1]),
        //        hash: "SHA-256",
        //    },
        //    true,
        //    ["sign", "verify"]
        //).then(data => {
        //    console.log("************************************************************************");
        //    console.log(data);
        //    crypto.subtle.exportKey("jwk", data.privateKey).then(key => {
        //        console.log("Priv Key", key);
        //        console.log("Priv Key JSON", JSON.stringify(key));
        //    });
        //    crypto.subtle.exportKey("jwk", data.publicKey).then(key => {
        //        console.log("Publ Key jwk", key);
        //        console.log("Publ Key JSON", JSON.stringify(key));
        //    });
        //    });

   
        if (this.licenseData != null) {
            console.log("GetExtensionLicensData hitCache", this.licenseData );
            deferred.resolve(this.licenseData);
        }
        else {
            var licClient = this;
            var t0 = performance.now();
            VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then(
                dataService => {
                    console.log("GetExtensionLicensData.getService DONE:  " + (performance.now() - t0));

                    dataService.getDocument("licenseStorage", "42").then(
                        data => {
                            console.log("GetExtensionLicensData.getDocument :  Done" + (performance.now() - t0), data);

                            licClient.licenseData = data; 
                            licClient.licenseData.licensPools.forEach((p, ix) => {
                                if (p.name == null || p.name=="") {
                                    p.name = "Subscription " + (ix + 1);
                                }
                            });

                            this.licenseData.assignedUsers.forEach((u, ix) => {
                                u.assigned = u.assigned == null ? false : u.assigned;
                            });

                            deferred.resolve(data); },
                        err => {
                            this.licenseData = {
                                id: "42",
                                defaultBilling: this.licenseData.defaultBilling = { company: "", adr1: "", adr2: "", country: "", city: "", zip: "", vat: "" }, 
                                licensPools: [],
                                assignedUsers: []
                            };
                            deferred.resolve(this.licenseData);
                        }
                    );
                },
                err => { console.log("Err getting ", err) }
            );
        }
        return deferred.promise();
    }

    SetDefBilling(company: string, adr1: string, adr2: string, country: string, city: string, zip: string, vat: string) {
        this.licenseData.defaultBilling = { company: company, adr1: adr1, adr2: adr2, country: country, city: city, zip: zip, vat: vat };
    }

    public StoreLicensingData(data?: ILicensServer.IExtensionLicensData): IPromise<boolean> {
        var deferred = $.Deferred<boolean>();
        var licClient = this;
        if (data == null) {
            data = this.licenseData;
        }

        VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then(dataService => {
            data.id = "42";
            dataService.setDocument("licenseStorage", data).then(
                doc => {
                    console.log("Permissions.setDocument successfully");
                    deferred.resolve(doc);
                },
                err => {
                    console.log("Permissions.setDocument error ", err);
                    deferred.reject(err);
                });
        });

        return deferred.promise();
    }

    public AddLicensPool(pool: ILicensServer.ILicensPool) {
        
        var p = this.licenseData.licensPools.filter(i => { return i.poolId == pool.poolId });
        if (p.length>0) {
            p[0] = pool;
        }
        else {
            var poolCnt = this.licenseData.licensPools.length;
            pool.poolId = poolCnt.toString();
            pool.name = poolCnt == 0 ? "Default" : "Subscription " + (poolCnt + 1);

            this.licenseData.licensPools.push(pool);
        }
    }
}


