
import * as Common from "./Common"
import * as IMarketplaceServer from "./BYOL_IMarketplaceServer"

import * as MarketplaceServer from "./BYOL_marketplaceServer"





interface ISubscriptionPayLoad {
    subscription: IMarketplaceServer.ISubscriptionInfo;
}

interface IPlansPayload {
    plans: IMarketplaceServer.IPlanInfo[];
}

export class chargeBeeMarketplaceService implements IMarketplaceServer.IMarketplaceService {
    public API_key: string = ""
    public licenseServerURL: string = "";
    constructor(url:string, apiKey: string) {
        this.API_key = apiKey;
        this.licenseServerURL = url;
    }

    public GetSubscription(subscription: string): IPromise<IMarketplaceServer.ISubscriptionInfo> {
        var deferred = $.Deferred<IMarketplaceServer.ISubscriptionInfo>();

        console.log("GetSubscription", subscription);
        $.getJSON(this.licenseServerURL + "/api/Subscription/" + subscription + this.API_key).then(
            data => {
                console.log("GetSubscription response", data)
                if (data != null && data.subscription!=null) {
                    var subPayLoad: ISubscriptionPayLoad = data;
                    subPayLoad.subscription.state = data.subscription.status;
                    console.log("GetSubscription resolve", subPayLoad.subscription);
                    deferred.resolve(subPayLoad.subscription)
                }
                else {
                    console.log("GetSubscription resolve NULL");
                    deferred.resolve(null)
                }
            });

        return deferred.promise();
    }

    public GetSubscriptionInvocies(subscription: string): IPromise<IMarketplaceServer.IInvoice[]> {
        var self = this;
        var deferred = $.Deferred<IMarketplaceServer.IInvoice[]>();

        console.log("GetSubscriptionInvocies", subscription);
        $.getJSON(this.licenseServerURL + "/api/Subscription/" + subscription + "/Invoices" + this.API_key).then(
            data => {
                console.log("GetSubscription response", data);

                data.forEach(i => {
                    i.url = this.licenseServerURL + "/api" + i.url + self.API_key;
                    i.date = new Date(i.date);
                    i.dueDate = new Date(i.dueDate);
                });
                
                deferred.resolve(data)
            });

        return deferred.promise();
    }

    public PriceMessage(p:IMarketplaceServer.IPlanInfo) {
        var s= ""
        if (p.price != null) {
            s = Common.formatCurrenct(p.price, p.currencyCode,0) + "/" + (p.period == 1 ? "" : p.period + " ") + p.periodUnit;
        }
        else if (p.tiers != null) {
            var lowPrice = p.tiers.sort((a, b) => { return a.price - b.price; })[0].price

            s = "Starting from " + Common.formatCurrenct(lowPrice, p.currencyCode,0) + "/" + (p.period == 1 ? "" : p.period + " ") + p.periodUnit
        }
        return s;
    }

    public  GetPlans(): IPromise<IMarketplaceServer.IPlanInfo[]> {
        var deferred = $.Deferred<IMarketplaceServer.IPlanInfo[]>();
        var plansPayload: IPlansPayload = { plans: [] };
        try {
            console.log("ChargeBee GetPlans");
            
            $.getJSON(this.licenseServerURL + "/api/Plans"+ this.API_key).then(
                data => {
                    console.log("GetPlans response", data);
                   
                    plansPayload.plans = data.map(p => {
                  
                        p.priceText = this.PriceMessage(p);
                        return p;
                    });

                    console.log("GetPlans resolve", plansPayload.plans); 
                    deferred.resolve(plansPayload.plans);
                });
                
          

            //plansPayload.plans.push({
            //    id: "NamedUsers",
            //    name: "Named Users",
            //    description: "With this plan you only pay for the named user you want to provide access to",
            //    price: 0.0,
            //    period: 1,
            //    period_unit: "month",
            //    pricing_model: "stairstep",
            //    charge_model: "stairstep",
            //    currency_code: "USD"
            //});
            
        }
        catch (ex) {
            console.log("GetPlans error", ex);
        }

        return deferred.promise();
    }

    public StartTrial(customer: IMarketplaceServer.ICustomer): IPromise<any> {
        return this.CreatSubscription(customer, null, "trial", 1);
    }

    public CreatSubscription(customer: IMarketplaceServer.ICustomer, cardToken:string, planId:string, quanity:number ): IPromise<any> {
        var deferred = $.Deferred<any>();
        var self = this;
        VSS.getAppToken().then(token => {
            // Add token to your request


            var dataObj = {
                planId: planId,
                planQuantity: quanity,
                customer: customer,
                cardToken: cardToken,
            };

            console.log(dataObj);

            try {
                console.log("ChargeBee CreatSubscription");
                $.ajax({
                    url: this.licenseServerURL + "/api/CreateSubscription" + self.API_key,                    
                    type: 'POST',
                    contentType: "application/json",
                    data: dataObj,
                    dataType: 'json'
                }).then(data => {
                    console.log("ChargeBee CreatSubscription resolve", data);
                    deferred.resolve(data);
                });
            }
            catch (ex) {
                console.log("GetPlans error", ex);
            }
        });

        return deferred.promise();
    }

    public UpdateSubscription(subscriptionId: string, planId: string, quanity: number) :IPromise<any> {
        var deferred = $.Deferred<any>();

        var dataObj = {
            subscriptionId: subscriptionId,
            planId: planId,
            planQuantity: quanity,
        };
        console.log(dataObj);

        try {
            console.log("ChargeBee UpdateSubscription");
            $.ajax({
                url: this.licenseServerURL + "/api/UpdateSubscription" + this.API_key,
                type: 'POST',
                contentType: "application/json",
                data: dataObj,
                dataType: 'json'
            }).then(data => {
                console.log("ChargeBee UpdateSubscription resolve", data);
                deferred.resolve(data);
            });
        }
        catch (ex) {
            console.log("UpdateSubscription error", ex);
        }

        return deferred.promise();
    }

    public CancelSubscription(subscriptionId: string): IPromise<any> { 
        var deferred = $.Deferred<any>();

        var dataObj = {
            subscriptionId: subscriptionId,      
        };
        console.log(dataObj);

        try {
            console.log("ChargeBee CancelSubscription");
            $.ajax({
                url: this.licenseServerURL + "/api/CancelSubscription" + this.API_key,
                //url: "http://localhost:7071" + "/api/CreateSubscription", //?code=tp/9iwa9GNeeOeUeawMWZL3ymhnWED8L/vdHriFgFVOrweYrMU8HWw==",
                type: 'POST',
                contentType: "application/json",
                data: dataObj,
                dataType: 'json'
            }).then(data => {
                console.log("ChargeBee CancelSubscription resolve", data);
                deferred.resolve(data);
            });
        }
        catch (ex) {
            console.log("CancelSubscription error", ex);
        }

        return deferred.promise();
    }
}
