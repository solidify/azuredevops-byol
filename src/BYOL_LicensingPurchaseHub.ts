/// <reference path="ref/monaco.d.ts" />
/// <reference path="ref/stripe.d.ts" />

import Q = require("q");

import Controls = require("VSS/Controls");
import Combos = require("VSS/Controls/Combos");
import Grids = require("VSS/Controls/Grids");
import TreeView = require("VSS/Controls/TreeView");
import FileInput = require("VSS/Controls/FileInput");
import UtilsCore = require("VSS/Utils/Core");
import * as LicensingClient from "VSS/Licensing/RestClient";

import LicensingContracts = require("VSS/Licensing/Contracts");

import Menus = require("VSS/Controls/Menus");
import Navigation = require("VSS/Controls/Navigation");
import Dialogs = require("VSS/Controls/Dialogs");
import SplitterControls = require("VSS/Controls/Splitter");


import CoreClient = require("TFS/Core/RestClient");
import CoreContracts = require("TFS/Core/Contracts");
import CommonContracts = require("VSS/WebApi/Contracts");

import * as Common from "./Common"

import * as Telemetry  from "./TelemetryClient";

import * as IMarketplaceServer from "./BYOL_IMarketplaceServer";

import * as ILicensServer from "./BYOL_ILicensServer";
import { registerWorkItemExportTab } from "./EnhancedExport";

import { ILicensPool } from "./BYOL_ILicensServer";
import { ITab } from "VSS/Controls/TabContent";
import { Dialog } from "VSS/Controls/Dialogs";
import { validateGroup } from "VSS/Controls/Validation";
import { makeElementUnselectable } from "VSS/Utils/UI";
import { IPromise, defer } from "q";
import { IdentityRef } from "VSS/WebApi/Contracts";


import Identities_Picker_RestClient = require("VSS/Identities/Picker/RestClient");
import Identities_Picker_Services = require("VSS/Identities/Picker/Services");
import Identities_Picker_Cache = require("VSS/Identities/Picker/Cache");
import { IdentityPickerSearchControl, IIdentityPickerSearchOptions } from "VSS/Identities/Picker/Controls";

import IdentitiesRestClient = require("VSS/Identities/RestClient");
import { CommonIdentityPickerHttpClient } from "VSS/Identities/Picker/RestClient";
import { IPlanInfo } from "./BYOL_IMarketplaceServer";

interface IPoolSummary
{
    free: number; 
    paid: number;
    assigned: number;
    available: number; 
    requested: number;
}


export class LicensingPurchaseHub {
    
    public height = 600;
    public width=960;
    public tabPlan: tabPlanSelect;
    public tabQuantity: tabQuantitySelect
    public tabCheckOut: tabCheckOut;
    public tabStartTrial: tabStartTrial;
    public tabCancel: tabCancelSub;
    public content:JQuery;

    public selectedPlan: IMarketplaceServer.IPlanInfo;
    public selectedQuantity: number;
    public totalPrice: number;
    public config = { unit: "user" };
    public srvExtLic: ILicensServer.IExtensionLicensServer;
    public licensPool: ILicensPool;
    public defualtBilling?: any;
    public dialogHandle: Dialogs.Dialog;
    public allUsers: CommonContracts.IdentityRef[];

    public configBYOL: IBYOLConfig;

    public mode: string;

    public Init($content: JQuery, mode: string) {
        var view = this;

        view.content = $content;
        view.mode = mode;

        $content.find("#dlgPurchaseFlow").show();
        view.content.find("#main").hide();
        this.StartLoading();
        if (mode =="New" || mode=="StartTrial") { 
            getAllUsers().then(data => {
                view.allUsers = data;
                //({data: view.allUsers.map(i => { return { id: i.id, text: i.displayName }; }) });
            });
        }

        var lst: IPromise<any>[] = [];

        
        console.log("before get data");

        lst.push(this.srvExtLic.GetExtensionLicensData());
        if (mode != "StartTrial") {
            lst.push(this.configBYOL.marketplaceServer.GetPlans());
        }

        //var licSrv = LicensingClient.getClient();
        //var licensIx = lst.length;

        //console.log("************************* getAccountLicensesUsage *********************************")
        //lst.push(licSrv.getAccountLicensesUsage());


        
        Q.all(lst).then(
            data => {
                var extLicData: ILicensServer.IExtensionLicensData = <ILicensServer.IExtensionLicensData>data[0];
                var plans = <IMarketplaceServer.IPlanInfo[]>data[1];
                //var licensData = <LicensingContracts.AccountLicenseUsage[]>data[licensIx];

                if (plans!=null && extLicData.licensPools.length > 0) {
                    var lp = extLicData.licensPools[0];
                    view.selectedPlan = plans.filter(i => { return i.id == lp.planId; })[0];
                    view.selectedQuantity = lp.purchasedQuantity;
                }

                //var userCnt = 0;
                //licensData.forEach(l => {
                //    console.log(l);
                //});
                        
                view.tabPlan = new tabPlanSelect();
                view.tabPlan.plans = plans;
                view.tabPlan.Init($content.find("#tab-plans-content"), view);

                view.tabQuantity = new tabQuantitySelect();
                view.tabQuantity.Init($content.find("#tab-quantity-content"), view);

                view.tabCheckOut = new tabCheckOut();
                view.tabCheckOut.Init($content.find("#tab-checkout-content"), view);

                view.tabStartTrial = new tabStartTrial();
                view.tabStartTrial.Init($content.find("#tab-startTrial-content"), view);

                view.tabCancel = new tabCancelSub();
                view.tabCancel.Init($content.find("#tab-cancel-content"), view);

                view.content.find("#main").show();
                switch (mode) {
                    case "Cancel":
                        view.ShowTab("#tabCancel")
                        view.content.find("#TabContainer").hide();
                        break;
                    case "Quantity":
                        view.ShowTab("#tabQuantity");
                        view.content.find("#TabContainer").hide();
                        break;
                    case "New":
                        view.ShowTab("#tabSelectPlan");
                        break;

                    case "StartTrial":
                        view.ShowTab("#tabStartTrial");
                        view.content.find("#TabContainer").hide();
                        break;
                }

            },
            err => {
                console.log("Error getting all ", err);
            }
        );

        this.content.find("#TabContainer").find("li").bind('click', { view }, e => {
            view.ShowTab("#"+e.currentTarget["id"]);
        });
    }

    public ShowTab(tabName: string) {
        var tabContentId: string = "";
        switch (tabName) {
            case "#tabCheckOut":
                tabContentId = "#tab-checkout-content";
                this.tabCheckOut.refresh();
                break;
            case "#tabQuantity":
                tabContentId = "#tab-quantity-content";
                this.tabQuantity.refresh();
                break;
            case "#tabSelectPlan":
                tabContentId = "#tab-plans-content";
                this.tabPlan.refresh();
                break;
            case "#tabCancel":
                tabContentId = "#tab-cancel-content";
                this.tabPlan.refresh();
                break;
            case "#tabStartTrial":
                tabContentId = "#tab-startTrial-content";
                this.tabStartTrial.refresh();
                break;
        }
        this.ShowTabContent(tabName, tabContentId);
    }

    private ShowTabContent( tabId, tabContentId:string) {

        this.content.find("#TabContainer").find(".selected").removeClass("selected");
        this.content.find(tabId).addClass("selected");
        this.content.find("#main >.tab").hide();
        this.content.find(tabContentId).show();
    }

    public showWelcome() {
        var view = this;
        view.content.find("#TabContainer").hide();
        view.content.find(".tab").hide();
        view.content.find("#tab-welcome-content").show();
    }

    public StartLoading() {
        $("body").css("cursor", "progress");
    }

    public DoneLoading() {
        $("body").css("cursor", "default");
    }

    public CreateSubscription(customer:IMarketplaceServer.ICustomer, token, plan:IPlanInfo,  quantity: number) {
        var view = this;
        var user = VSS.getWebContext().user;

        if (view.licensPool! != null) {
            customer.customerId = view.licensPool.customerId;
        }

        this.configBYOL.marketplaceServer.CreatSubscription(customer, token.id, plan.id, quantity).then(
            data => {
                console.log("CreatSubscription resolved", data)

                var licensPool: ILicensServer.ILicensPool = {
                    owner: { imageUrl: findUserIdentity(user.id, view.allUsers).imageUrl, id: user.id, displayName: user.name, uniqueName: user.uniqueName },
                    state: "Active",
                    subscriptionId: data.subscription.Id,
                    customerId: data.subscription.CustomerId,
                    licensType: view.selectedPlan.licensType,
                    planId: plan.id,
                    planName: plan.name,
                    planDescription: plan.description,
                    purchasedQuantity: Number(data.subscription.PlanQuantity)

                };
                if (view.licensPool != null) {
                    view.licensPool = licensPool;
                }
                view.srvExtLic.SetDefBilling(customer.company, customer.adr1, customer.adr2, customer.country, customer.city, customer.zip, customer.vat)
                view.srvExtLic.AddLicensPool(licensPool);
                view.srvExtLic.StoreLicensingData().then(
                    data => {
                        console.log("Create subs resolved with", data)
                        view.showWelcome();
                    },
                );
            },
            err => {
                console.log("err", err);
            });
          
    }

    public UpdateSubscription(planId: string, quantity: number) {
        var view = this;

        if (view.licensPool) {
            this.configBYOL.marketplaceServer.UpdateSubscription(view.licensPool.subscriptionId, planId, quantity).then(
                data => {
                    console.log("Update Subscription resolved", data);
                    view.licensPool.purchasedQuantity = quantity;
                    view.licensPool.planId = planId;
                    view.srvExtLic.AddLicensPool(view.licensPool);
                    view.srvExtLic.StoreLicensingData().then(
                        data => {
                            console.log("Update subs resolved with", data)
                            view.showWelcome();
                        },
                    );
                });
        }
    }

    public CancelSubscription() {
        var view = this;
        var user = VSS.getWebContext().user;

        if (view.licensPool) {
            
            this.configBYOL.marketplaceServer.CancelSubscription(view.licensPool.subscriptionId).then(
                data => {
                    console.log("Update Subscription resolved", data);
                    view.licensPool.state = "Canceled";
                    view.srvExtLic.AddLicensPool(view.licensPool);
                    view.srvExtLic.StoreLicensingData().then(
                        data => {
                            console.log("Update subs resolved with", data)
                            view.dialogHandle.close();
                        },
                    );
                });
        }
    }

    public StartTrial(customer: IMarketplaceServer.ICustomer) {
        var view = this;
        var user = VSS.getWebContext().user;

        this.configBYOL.marketplaceServer.StartTrial(customer).then(
            data => {

                var licensPool: ILicensServer.ILicensPool = {
                    owner: { imageUrl: findUserIdentity(user.id, view.allUsers).imageUrl, id: user.id, displayName: user.name, uniqueName: user.uniqueName },
                    state: "Active",
                    subscriptionId: data.subscription.Id,
                    customerId: data.subscription.CustomerId,
                    licensType: "trial",
                    planId: data.subscription.PlanId,
                    planName: data.subscription.PlanName,
                    planDescription : data.subscription.PlanDescription,
                    purchasedQuantity:1

                };
                view.srvExtLic.SetDefBilling(customer.company, customer.adr1, customer.adr2, customer.country, customer.city, customer.zip, customer.vat)
                view.srvExtLic.AddLicensPool(licensPool);
                view.srvExtLic.StoreLicensingData().then(
                    data => {
                        console.log("Create subs resolved with", data)
                        view.showWelcome();
                    },
                );
            });
     
    }

    protected setTitle(title: string) {
        if (this.dialogHandle != null) {
            this.dialogHandle.setTitle(title);
        }
    }
}

interface ITabContent {
   // Init(content: JQuery, mainView: LicensingPurchaseHub);
    refresh();
}


export class tabPlanSelect implements ITabContent{
    public mainView: LicensingPurchaseHub;
    protected content: JQuery;
    public plans: IMarketplaceServer.IPlanInfo[]

    constructor() {

    }

    public Init(content:JQuery,  mainView: LicensingPurchaseHub) {
      
        this.content = content;

        var view = this;
        view.mainView = mainView;

        view.mainView.StartLoading();
                
        view.RenderPlans();
        view.mainView.DoneLoading();
            
    }

    protected RenderPlans() {
        var view = this;
        var $tmplBuildIn = this.content.find("#planTemplate");
        var $planList = this.content.find("#planListContainer");
        $planList.empty();
        if (this.plans != null) {
            this.plans.forEach(p => {
                if (p.licensType != "trial") {
                    var $row = $tmplBuildIn.clone();
                    $row.css("display", "inline");

                    console.log("Showing plan ", p);
                    replaceTemplatesWithValues($row, "p.", p);

                    $row.bind('click', { view: view, plan: p }, e => {

                        view.mainView.selectedPlan = e.data.plan;
                        view.mainView.ShowTab("#tabQuantity");
                        view.mainView.tabQuantity.refresh();

                    });
                    console.log("Appending plan ", $row);
                    $planList.append($row);
                }
            });
        }
    }

    public refresh() {}
  
}

export class tabQuantitySelect implements ITabContent{
    public mainView: LicensingPurchaseHub;
    protected content: JQuery;
    public plans: IMarketplaceServer.IPlanInfo[]

    constructor() {

    }

    public Init(content: JQuery, mainView: LicensingPurchaseHub) {

        this.content = content;

        var view = this;
        view.mainView = mainView;

         
        view.content.find("#quantity").on("change", e => {
            console.log("Changing quantity", view.content.find("#quantity").val())
            view.updatePrice(view.content.find("#quantity").val());
        });
        var startQuantity = 1
        view.content.find("#quantity").val(startQuantity);
        view.updatePrice(startQuantity);

        if (view.mainView.mode == "Quantity") {
            view.content.find("#cmdNext").hide();
            view.content.find("#cmdUpdate").show();
            view.content.find("#cmdUpdate").on('click', e => {
                view.mainView.selectedQuantity = view.content.find("#quantity").val();
                view.mainView.UpdateSubscription(view.mainView.selectedPlan.id, view.mainView.selectedQuantity);
            });
        }
        else {
            view.content.find("#cmdUpdate").hide();
            view.content.find("#cmdNext").show();
            view.content.find("#cmdNext").on('click', e => {
                view.mainView.selectedQuantity = view.content.find("#quantity").val();
                view.mainView.ShowTab("#tabCheckOut");
                view.mainView.tabCheckOut.refresh();
            });
        }
    }


    protected updatePrice(quantity: number) {
        var total = quantity * 3;
        var pricelst = this.mainView.selectedPlan.tiers.filter(i => { return i.stop == quantity; });
        var total = pricelst[0].price;
        this.content.find("#total").text(total);
        this.mainView.totalPrice = total;
    }

    public refresh() {
        replaceTemplatesWithValues(this.content, "p.", this.mainView.selectedPlan);
        var $cbQuantity = this.content.find("#quantity");

        var tiers = this.mainView.selectedPlan.tiers;
        if (tiers != null) {
            $cbQuantity.find("option").remove();
            tiers.forEach(t => {
                if (t.stop != null) {
                    console.log("Adding option", t.stop);
                    $cbQuantity.append("<option value='" + t.stop + "'>" + t.stop + "</option>");
                }
            });
            if (this.mainView.selectedQuantity == null) {
                this.mainView.selectedQuantity = tiers[0].stop;
            }
            $cbQuantity.val(this.mainView.selectedQuantity);
            $cbQuantity.show();
        }
        else{
            $cbQuantity.hide();
        }
    }
  

}

export class tabCancelSub implements ITabContent {
    public mainView: LicensingPurchaseHub;
    protected content: JQuery;

    constructor() {

    }

    public Init(content: JQuery, mainView: LicensingPurchaseHub) {

        this.content = content;

        var view = this;
        view.mainView = mainView;

        replaceTemplatesWithValues(this.content, "p.", this.mainView.selectedPlan);
  
        view.content.find("#cmdCancel").on('click', e => {

            view.mainView.CancelSubscription();
        });
    }
   

   
    public refresh() {
        replaceTemplatesWithValues(this.content, "p.", this.mainView.selectedPlan);
  
    }


}

export class tabCheckOut implements ITabContent{
    public mainView: LicensingPurchaseHub;
    protected content: JQuery;

    protected stripe: stripe.Stripe;
    protected elements: stripe.elements.Elements;
    protected card: stripe.elements.Element;



    constructor() {

    }

    public Init(content:JQuery,  mainView: LicensingPurchaseHub) {
      
        this.content = content;

        console.log("User", VSS.getWebContext().user);

        var view = this;
        view.mainView = mainView;

        view.mainView.StartLoading();
        view.InitStripe();

        var user = VSS.getWebContext().user;
        var nameParts = user.name.split(" ");
        var lastName = nameParts[nameParts.length - 1].trim();
        var firstName = user.name.replace(lastName, "").trim();
        var val:any = { firstName: firstName, lastName: lastName, email: user.email };
        if (view.mainView.defualtBilling) {
            val.company = view.mainView.defualtBilling.company;
            val.adr1 = view.mainView.defualtBilling.adr1;
            val.adr2 = view.mainView.defualtBilling.adr2;
            val.country = view.mainView.defualtBilling.country;
            val.city = view.mainView.defualtBilling.city;
            val.zip = view.mainView.defualtBilling.zip;
            val.vat = view.mainView.defualtBilling.vat;
        }

        replaceTemplatesWithValues(this.content.find(".formRow"), "", val);

        view.content.find("#debug").on("click", e => {
            view.mainView.showWelcome();
        });

        view.mainView.DoneLoading();

    }

    public getYourBuyingMessage(plan: IMarketplaceServer.IPlanInfo, quantity:number, totalPrice:number): { licens: string, price: string } {
        return {
            licens: plan.name + " for " + quantity + " " + this.mainView.config.unit,
            price: Common.formatCurrenct(totalPrice, plan.currencyCode,0) + "/" + (plan.period==1?"":plan.period+" ")+  plan.periodUnit
        };
    }

    protected InitStripe() {
        var view = this; 
        view.stripe = Stripe( view.mainView.configBYOL.stripeKey);
        view.elements = view.stripe.elements();

        var style = {
            base: {
                // Add your base input styles here. For example:
                fontSize: '16px',
                color: "#32325d",
                '::placeholder': {
                    color: '#87BBFD',
                },

            }
        };

        // Create an instance of the card Element.
        view.card = view.elements.create('card', { hidePostalCode: true, style: style });

        // Add an instance of the card Element into the `card-element` <div>.
        view.card.mount(view.content.find('#creditCard')[0]);

        view.content.find("#cmdSend").on('click', e => {
            var planId = view.mainView.selectedPlan.id;
            var quantity = view.mainView.selectedQuantity;

            if (view.mainView.mode == "New") {

                view.stripe.createToken(view.card).then(function (result) {
                    if (result.error) {
                        // Inform the customer that there was an error.
                        var errorElement = view.content.find('#card-errors');
                        errorElement.textContent = result.error.message;
                    } else {
                        var customer: IMarketplaceServer.ICustomer = {
                            firstName: view.content.find("#firstName").val(),
                            lastName: view.content.find("#lastName").val(),
                            email: view.content.find("#email").val(),
                            adr1: view.content.find("#adr1").val(),
                            adr2: view.content.find("#adr2").val(),
                            country: view.content.find("#country").val(),
                            city: view.content.find("#city").val(),
                            zip: view.content.find("#zip").val(),
                            vat: view.content.find("#vat").val(),
                            company: view.content.find("#company").val(),
                        }


                        // Send the token to your server.
                        view.mainView.CreateSubscription(customer, result.token, view.mainView.selectedPlan, quantity);
                    }
                });
            }
            else {
                view.mainView.UpdateSubscription( planId, quantity);
            }

        });
    }

    public refresh() {
     
        var view = this;
        var buying = this.getYourBuyingMessage(view.mainView.selectedPlan, view.mainView.selectedQuantity, view.mainView.totalPrice)

        replaceTemplatesWithValues(this.content.find("#yourBuying"), "", buying);
    }

}

export class tabStartTrial implements ITabContent {
    public mainView: LicensingPurchaseHub;
    protected content: JQuery;

 
    constructor() {

    }

    public Init(content: JQuery, mainView: LicensingPurchaseHub) {

        this.content = content;

        console.log("User", VSS.getWebContext().user);

        var view = this;
        view.mainView = mainView;

        view.mainView.StartLoading();
       
        var user = VSS.getWebContext().user;
        var nameParts = user.name.split(" ");
        var lastName = nameParts[nameParts.length - 1].trim();
        var firstName = user.name.replace(lastName, "").trim();
        var val: any = { firstName: firstName, lastName: lastName, email: user.email };
   

        replaceTemplatesWithValues(this.content.find(".formRow"), "", val);

        view.content.find("#debug").on("click", e => {
            view.mainView.showWelcome();
        });

        view.content.find("#cmdStartTrial").on("click", e => {
  
            var customer: IMarketplaceServer.ICustomer = {
                firstName: view.content.find("#firstName").val(),
                lastName: view.content.find("#lastName").val(),
                email: view.content.find("#email").val(),
                company: view.content.find("#company").val(),
            }

            view.mainView.StartTrial(customer )
            
        });

        view.mainView.DoneLoading();

    }

    

    public refresh() {

       
    }

}

export class ManageLicensHub {

    public height = 600;
    public width = 960;
    public tabPoolsDirectory: tabPoolsDirectory;
    public tabPoolContent: tabPoolContent
 
    public content: JQuery;

   
    public config = { unit: "user" };
    public srvExtLic: ILicensServer.IExtensionLicensServer;
    public licensData: ILicensServer.IExtensionLicensData;
    public selectedPool: ILicensPool;
    public mode: string;
    public dialogHandle: Dialogs.Dialog;
    public allUsers: CommonContracts.IdentityRef[];

    public configBYOL: IBYOLConfig;


    public Init($content: JQuery, mode: string) {
        var view = this;
        this.content = $content;
        this.mode = mode;

        $content.find("#dlgManageLicensHub").show();
        view.content.find("#main").hide();
        this.StartLoading();

               
        view.tabPoolsDirectory = new tabPoolsDirectory();
        view.tabPoolsDirectory.pools = view.licensData.licensPools;
        view.tabPoolsDirectory.Init($content.find("#tab-directory-content"), view);

        view.tabPoolContent = new tabPoolContent();
        view.tabPoolContent.Init($content.find("#tab-licenspool-content"), view);

        view.content.find("#main").show();
        view.ShowTab("#tab-directory-content");

      
        //view.content.find("#peoplePicker").autocomplete({ source: ["Mattias Sköld", "Per Sundqvist", "Carola", "Jennie", "Terese"] });
      
        getAllUsers().then(data => {
            view.allUsers = data;
            view.tabPoolContent.updateUsers();
            //({data: view.allUsers.map(i => { return { id: i.id, text: i.displayName }; }) });
        });

        //this.content.find("#TabContainer").find("li").bind('click', { view }, e => {
        //    view.ShowTab("#" + e.currentTarget["id"]);
        //});
    }
    
    public ShowTab(tabContentId: string) {
        this.content.find("#main >.tab").hide();
        this.content.find(tabContentId).show();
        if (tabContentId == "#tab-directory-content") {
            this.setTitle("Subscriptions");
        }
        else {
            var name = this.selectedPool.name;
            name = name == "" ? "Subscription "+ this.licensData.licensPools.indexOf(this.selectedPool)+1 : name;
            this.setTitle("Subscriptions > " + name);
        }
    }

    protected setTitle(title: string) {
        if (this.dialogHandle != null) {
            this.dialogHandle.setTitle(title);
        }
    }

    public showWelcome() {
        var view = this;
        view.content.find("#TabContainer").hide();
        view.content.find(".tab").hide();
        view.content.find("#tab-welcome-content").show();
    }

    public StartLoading() {
        $("body").css("cursor", "progress");
    }

    public DoneLoading() {
        $("body").css("cursor", "default");
    }

    public AddNewPool() {
        var view = this;

        var trialPool: ILicensPool = null;
        var trials = view.licensData.licensPools.filter(i => { return i.licensType == "trial" });
        if (trials.length > 0) {
            trialPool = trials[0];
        }

        openPurchaceDlg(view.configBYOL, trialPool, "New", view.licensData.defaultBilling).then(data => {
            view.tabPoolsDirectory.refresh();
        })
    }

    public calcUsage(pool?:ILicensPool): IPoolSummary {
        pool = pool == null ? this.selectedPool: pool;
        var users = this.licensData.assignedUsers.filter(i => { return i.poolId == pool.poolId; });
        var total = users.length;
        var assigned = users.filter(i => { return i.assigned==true }).length;
        return { free: 0, paid: pool.purchasedQuantity, assigned: assigned, available: pool.purchasedQuantity - assigned, requested: total-assigned };
    }
}


export class tabPoolsDirectory implements ITabContent {
    public mainView: ManageLicensHub;
    protected content: JQuery;
    public pools: ILicensPool[];

    constructor() {

    }

    public Init(content: JQuery, mainView: ManageLicensHub) {

        this.content = content;

        var view = this;
        view.mainView = mainView;

        view.mainView.StartLoading();

        view.renderPools();
        view.mainView.DoneLoading();

        view.content.find("#cmdNewPool").on('click', e => {
            view.mainView.AddNewPool();
        });

        view.content.find("#cmdTrial").on('click', e => {
            openPurchaceDlg(view.mainView.configBYOL ,  null, "StartTrial");
        });

        
    }

    protected renderPools() {
        var view = this;
        var $tmplBuildIn = this.content.find("#licensPoolTemplate");
        var $poolList = this.content.find("#poolListContainer");
        $poolList.empty();

        view.pools.forEach((p,ix) => {
            var $row = $tmplBuildIn.clone();
            $row.css("display", "inline");
            $row.find("#licensPoolTemplate").attr("id", "pool-"+ix);

            console.log("Showing pool ", p);

            $row.find("#imgOwner").attr("src", p.owner.imageUrl);
            $row.find("#ownerName").text(p.owner.displayName);
            $row.find("#poolName").text(p.name);
            $row.find("#poolState").text(p.state);
            $row.find("#planName").text(p.planName);
            $row.find("#planDesc").text(p.planDescription);
            $row.find("#poolLicensType").text(p.licensType);
            

            renderSummary($row.find("#poolUsageSummary"), view.mainView.calcUsage(p));
            if (p.licensType == "enterprise") {
                $row.find("#poolUserDetails").hide()
            }

            $row.find("#lnkName").bind('click', { view: view, pool: p }, e => {
                view.mainView.selectedPool = e.data.pool;
                view.mainView.ShowTab("#tab-licenspool-content");
                view.mainView.tabPoolContent.refresh();
            });

            $row.find("#lnkRequestLicens").bind('click', { view: view, pool: p }, e => {
                var pool = e.data.pool;
                var user = VSS.getWebContext().user;
                view.mainView.licensData.assignedUsers.push({
                    assigned:false,
                    poolId: pool.id,
                    userId: user.id,
                    userDisplayName: user.name,
                    userEmail: user.email,
                    imageUrl: findUserIdentity(user.id, this.mainView.allUsers).imageUrl
                });
                view.mainView.srvExtLic.StoreLicensingData();
                view.refresh();
            });

            console.log("Appending pool ", $row);
            $poolList.append($row);
        });
    }

    public refresh() {
        this.renderPools();
    }

}

export class tabPoolContent implements ITabContent {
    public mainView: ManageLicensHub;
    protected content: JQuery;
    protected gridInvoices: Grids.Grid;
    protected gridAssignedUsers: Grids.Grid;
    protected gridRequestedUsers: Grids.Grid;

    constructor() {

    }

    public Init(content: JQuery, mainView: ManageLicensHub) {

        this.content = content;

        var view = this;
        view.mainView = mainView;

        view.mainView.StartLoading();

        view.content.find("#lnkChangeQuantity").bind("click", e => {
            e.preventDefault();
            openPurchaceDlg(this.mainView.configBYOL, this.mainView.selectedPool, "Quantity").then(data => {
                view.refresh();
            })
        })

        view.content.find("#txtSearchUser").on("keyup", e => {
            console.log(e);
            view.searchForUsers();
        })

        view.hideOnClickOutside("#peopleSearcher");
        

        view.content.find("#peoplePicker").on("change", e => {
            console.log(e);
            view.parseForUsers();
        })

        view.content.find("#lnkCancelSubscription").bind("click", e => {
            e.preventDefault();
            openPurchaceDlg(this.mainView.configBYOL, this.mainView.selectedPool, "Cancel").then(data => {
                view.refresh();
            })
        });

        view.content.find("#cmdSave").on("click", e => {
            view.mainView.srvExtLic.StoreLicensingData();
            view.mainView.ShowTab("#tab-directory-content");
        })

        var custIdentityClient: CustomIdentityClient = new CustomIdentityClient();


    
        view.createUserGrids();

        view.createInvoiceGrids();
       
        this.content.find("#TabContainer").find("li").bind('click', { view }, e => {
            view.ShowTab("#" + e.currentTarget["id"]);
        });

        this.content.find("#cmdAddUsers").on('click', e => {
            var pool = view.mainView.selectedPool;

            var noLeft = pool.purchasedQuantity - view.mainView.licensData.assignedUsers.filter(i => {
                return i.poolId == pool.poolId && i.assigned == true;
            }).length;

            var $usersDiv = view.content.find("#peopleSearcher").find(".identity-picker-resolved");
            $usersDiv.each((ix, uDiv) => {
                var userId = uDiv.id;
                var users = view.mainView.allUsers.filter(i => { return i.id == userId; });
                if(users.length > 0){
                    view.mainView.licensData.assignedUsers.push({
                        poolId: pool.poolId,
                        userId: users[0].id,
                        userEmail: users[0].uniqueName,
                        userDisplayName: users[0].displayName,
                        imageUrl: users[0].imageUrl,
                        assigned: true
                    });
                }                
            });
            
            view.content.find("#peopleSearcher").remove(".identity-picker-resolved");
            view.refresh();
        });

        this.content.find("#cmdPromote").on('click', e => {
            var pool = view.mainView.selectedPool;
         
            var noLeft = pool.purchasedQuantity - view.mainView.licensData.assignedUsers.filter(i => {
                return i.poolId == pool.poolId && i.assigned == true;
            }).length;

            view.gridRequestedUsers._dataSource.forEach(r => {
                if (r.checked == true) {
                    view.mainView.licensData.assignedUsers.forEach(i => {
                        if (i.poolId == pool.poolId) {
                            if (i.userId == r.userId) {
                                i.assigned = noLeft>0?true:false;
                                noLeft--;
                            }
                        }
                    });
                }
            });
            view.refresh();
        });

        view.ShowTab("#tabPoolUsers");
        view.mainView.DoneLoading();

    }

    protected hideOnClickOutside(selector) {
        const outsideClickListener = (event) => {
            let $target = $(event.target);
            if (!$target.closest(selector).length && $(selector).is(':visible')) {
                $(selector).hide();
                removeClickListener();
            }
        }

        const removeClickListener = () => {
            document.removeEventListener('click', outsideClickListener)
        }

        document.addEventListener('click', outsideClickListener)
    }


    protected createUserGrids() {
        var view = this;
        var optGrdUsers: Grids.IGridOptions = {
            width: "100%",
            height: "100%",

            lastCellFillsRemainingContent: false,
            columns: [
                { index: "userDisplayName", text: "Display name", getCellContents: getImgDisplayCellContent, width: 150 },
                { index: "userEmail", text: "Email", width: 150 },
                { index: "", text: "", getCellContents: getUrlCellContent }
            ]
        }
        var optGrdRequestedUsers: Grids.IGridOptions = {
            width: "100%",
            height: "100%",

            lastCellFillsRemainingContent: false,
            columns: [
                { index: "assigned", text: "", getCellContents: getCheckBoxContent, width: 20 },
                { index: "userDisplayName", text: "Display name", getCellContents: getImgDisplayCellContent, width: 150 },
                { index: "userEmail", text: "Email", width: 150 }
            ]
        }

        view.gridAssignedUsers = Controls.create(Grids.Grid, view.content.find("#gridAssignedUsers"), optGrdUsers);
        view.gridRequestedUsers = Controls.create(Grids.Grid, view.content.find("#gridRequestedUsers"), optGrdRequestedUsers);

    }

    protected createInvoiceGrids() {
        var view = this;
        var optGrdInvoices: Grids.IGridOptions = {
            width: "100%",
            height: "100%",

            lastCellFillsRemainingContent: false,
            columns: [
                { index: "id", text: "Number" },
                { index: "date", text: "Date", format: "d" },
                { index: "state", text: "State" },
                { index: "totalAmount", text: "Amount", headerCss: "rightAlign", getCellContents: getAmountContent },
                { index: "dueDate", text: "Due date", format: "d" },
                { index: "dueAmount", text: "Due amount", headerCss: "rightAlign", getCellContents: getAmountContent },
                { index: "url", text: "", getCellContents: getUrlCellContent }
            ]
        }
        view.gridInvoices = Controls.create(Grids.Grid, view.content.find("#gridInvoices"), optGrdInvoices);


    }

    public ShowTab(tabName: string) {
        var tabContentId: string = "";
        switch (tabName) {
            case "#tabPoolInvoices":
                tabContentId = "#tabInvoices";
                this.renderInvoices();
                break;
            case "#tabPoolUsers":
                tabContentId = "#tabUsers";
                this.renderUsers();
                break;
   
        }
        this.ShowTabContent(tabName, tabContentId);
    }

    public renderInvoices() {
        var view = this;
        if (view.mainView.selectedPool != null) {
            view.mainView.StartLoading();
            

            //var $tbody = view.content.find("#invoicesTableBody");
            //$tbody.append("<tr><td colspan='4'>Loading invoices...</td></tr>");

           
            view.mainView.configBYOL.marketplaceServer.GetSubscriptionInvocies(view.mainView.selectedPool.subscriptionId).then(invocies => {
                view.mainView.DoneLoading();
                view.gridInvoices.setDataSource(invocies);

                //$tbody.find("tr").remove();
                //invocies.forEach(i => {
                //    var s = "<tr><td>" + i.id + "</td><td>" + UtilsCore.convertValueToDisplayString(i.date, "d") + "</td>";
                //    s += "<td>" + i.state + "</td><td>" + Common.formatCurrenct(i.totalAmount, i.currencyCode,2) + "</td>"
                //    s += "<td>" + UtilsCore.convertValueToDisplayString(i.dueDate, "d") + "</td>";
                //    s += "<td>" + Common.formatCurrenct(i.dueAmount, i.currencyCode,2) + "</td>"
                //    s += "<td><a href='" + i.url + "' target='_blank'>download</a></td>"
                //        $tbody.append(s);
                //});
            });
        }
    }

    public renderUsers() {
        var view = this;
        var pool = view.mainView.selectedPool
        if (pool!= null) {
            if (pool.licensType == "enterprise") {
                view.content.find("#enterpriseUsers").show();
                view.content.find("#namedUsers").hide();

            }
            else {
                view.content.find("#enterpriseUsers").hide();
                view.content.find("#namedUsers").show();

            }
            var assignedUsers = view.mainView.licensData.assignedUsers.filter(i => { return i.poolId == pool.poolId && i.assigned == true; });
            var requestedUsers = view.mainView.licensData.assignedUsers.filter(i => { return i.poolId == pool.poolId && i.assigned==false; });
            view.gridAssignedUsers.setDataSource(assignedUsers);
            view.gridRequestedUsers.setDataSource(requestedUsers);


            //var $tbody = view.content.find("#assignedUsersTableBody");
            //$tbody.find("tr").remove();
            //users.forEach(u => {
            //    $tbody.append("<tr><td><img  class='small-identity  identity-picture identity-image' src='" + u.imageUrl + "'> " + u.userDisplayName + "</td><td>" + u.userEmail + "</td></tr>");
            //});
        }
    }

    private ShowTabContent(tabId, tabContentId: string) {

        this.content.find("#TabContainer").find(".selected").removeClass("selected");
        this.content.find(tabId).addClass("selected");
        this.content.find("#licensPoolMain >.tab").hide();
        this.content.find(tabContentId).show();
    }



    protected searchForUsers() {
        var view = this;

        this.parseForUsers();
        var s = view.content.find("#txtSearchUser").val().toLowerCase();
        var $searchContainer = view.content.find("#peopleSearcher");
        var br = $searchContainer[0].getBoundingClientRect();

        var $resultContainer = view.content.find("#searchResultContainer");
        $resultContainer.show();

        $resultContainer.css("left",br.left);
        $resultContainer.css("top", $searchContainer[0].getBoundingClientRect().bottom + 1);
        $resultContainer.css("right", br.right);


        var $resultList = view.content.find("#searchResult");

        $resultList.empty();
        if (s != "") {
            view.mainView.allUsers.forEach(u => {
                if (u.displayName.toLowerCase().indexOf(s) >= 0 || u.uniqueName.toLowerCase().indexOf(s) >= 0) {
                    var sItem = "<li style='list-style:none;clear:left;'><div class='peopleSearchItem' >";
                    sItem += "<img src='" + u.imageUrl + "' class='identity-picture element-2d-large' style='background: no-repeat 0% 0% / 100%;float:left' > ";
                    sItem += "<div>"+ u.displayName + "</div><div>" + u.uniqueName +"</div>";
                    sItem += "</div></li>"
                    var $item = $(sItem);
                    $item.click({ uniqueName: u.uniqueName}, e => {
                        view.content.find("#txtSearchUser").val(e.data.uniqueName);
                        view.parseForUsers();
                        $resultContainer.hide();
                    });

                    $resultList.append($item);
                }
            });
        }
    }

    protected parseForUsers() {
        var view = this;
        var $txtSearch = view.content.find("#txtSearchUser");
        var s = $txtSearch.val().toLowerCase();
        view.mainView.allUsers.forEach(u => {
            if (s.indexOf(u.displayName.toLowerCase()) >= 0 || s.indexOf(u.uniqueName.toLowerCase())>=0) {
              
                var full = u.displayName.toLowerCase() + " <" + u.uniqueName.toLowerCase() + ">"
                if (s.indexOf(full) >= 0) {
                    s = s.replace(full, "");
                } else if (s.indexOf(u.displayName.toLowerCase()) >= 0) {
                    
                    s = s.replace(u.displayName.toLowerCase(), "");
                } else if (s.indexOf(u.uniqueName.toLowerCase()) >= 0) {
                    
                    s = s.replace(u.uniqueName.toLowerCase(), "");
                }


                console.log("User found");
                var sUser = "<span id='"+ u.id +"' class='identity-picker-resolved identity-picker-resolved-bg element-height-medium'>";
                sUser += "<img src='" + u.imageUrl + "' class='user-picture-resolved element-2d-medium'>";;
                sUser += "<span class='identity-picker-resolved-name identity-picker-search-multiple-name pointer-cursor'>"+ u.displayName + "</span>";
                sUser += "<span class='identity-picker-resolved-close identity-picker-resolved-bg identity-picker-resolved-single-bg element-2d-medium'>";
                sUser += "<span id='delUsr' class='identity-picker-resolved-close-icon bowtie-icon bowtie-edit-delete'></span></span></span>";

                
                var $userSpan = $(sUser);
                $userSpan.find("#delUsr").click({ id: u.id }, e => {
                    view.content.find("#" + e.data.id).remove();
                    view.setSearchUserSize($txtSearch);
                });

                $userSpan.insertBefore($txtSearch);

                console.log("User found");
                view.content.find("#txtSearchUser").val("");
                view.setSearchUserSize($txtSearch);


                //var au: ILicensServer.ILicensAssignment = {
                //    assigned:true,
                //    poolId: view.mainView.selectedPool.poolId,
                //    userId: u.id,
                //    userEmail: u.uniqueName,
                //    userDisplayName: u.displayName,
                //    imageUrl:u.imageUrl
                //};

                //view.mainView.licensData.assignedUsers.push(au);
            }
        });
        view.refresh();
        view.content.find("#peoplePicker").val(s);
    }

    public updateUsers() {

    }

    protected setSearchUserSize($txtSearch:JQuery) {
        var view = this;
        var newWidth = $txtSearch[0].parentElement.clientWidth;
        for (var i = 0; i < $txtSearch[0].parentElement.children.length; i++) {
            var e = $txtSearch[0].parentElement.children[i]
            if (e.nodeName == "SPAN") {
                newWidth -= e.getBoundingClientRect().width;
            }
        }
        view.content.find("#txtSearchUser").css("width", newWidth - 5);
    }

    public refresh() {

        renderSummary(this.content.find("#useageSummaryRow"), this.mainView.calcUsage());

        if (this.mainView.selectedPool.licensType == "enterprise") {
            this.content.find("#useageSummaryRow").hide();
            this.content.find("#lnkChangeQuantity").hide();
        }
        else {
            this.content.find("#useageSummaryRow").show();
            this.content.find("#lnkChangeQuantity").show();

        }

      

        this.content.find("#poolState").text(this.mainView.selectedPool.state);
        this.content.find("#poolOwnerImg").attr("src", this.mainView.selectedPool.owner.imageUrl);
        this.content.find("#poolOwnerName").text(this.mainView.selectedPool.owner.displayName);
        this.content.find("#poolPlan").text(this.mainView.selectedPool.planId);
        
        this.renderUsers();
    }
    
}


function renderSummary(container: JQuery, sum: IPoolSummary) {
    var s = sum.free + " free | " + sum.paid + " paid | " + sum.assigned + " assigned | " + sum.available + " available | " + sum.requested + " requested "
    container.text(s);
}

function replaceTemplatesWithValues(item: JQuery, prefix: string, p: any) {

    var fields: { name: string, value: string }[] = [];
    for (var fieldName in p) {
        if (p.hasOwnProperty(fieldName)) {
            var s = "{" + prefix + fieldName + "}";
            fields.push({ name: s, value: p[fieldName]});
        }
    }

    item.each((ix, e) => {       
      
      replaceTemplatesWithValuesHTML(e.children, fields)
    });
}

function replaceTemplatesWithValuesHTML(items: HTMLCollection, fields: { name: string, value: string }[]) {

    for (var i = 0; i < items.length; i++) {
        var e = items[i]
//        if (e.nodeType == 3) {
        var txtContent = e.textContent;
        if (txtContent && txtContent.indexOf("{") >= 0) {
            fields.forEach(field => {
                if (txtContent.indexOf(field.name) >= 0) {
                    txtContent = txtContent.replace(field.name, field.value);
                }
            });
//            console.log("replacing", e.textContent, txtContent, e);
            e.textContent = txtContent;
        }
        var valueAttrib = e.getAttribute("value");
        if (valueAttrib != null && valueAttrib.indexOf("{") >= 0) {
            fields.forEach(field => {
                if (valueAttrib.indexOf(field.name) >= 0) {
                    valueAttrib = valueAttrib.replace(field.name, field.value);
                }
            });
 //           console.log("setAttribute", e.getAttribute("value"), valueAttrib, e);
            e.setAttribute("value", valueAttrib);
        }

        if(e.children) {
            replaceTemplatesWithValuesHTML(e.children, fields);
        }
    }
}

function concatUnique(a:IdentityRef[], b:IdentityRef[], seen:any) {    
       
    return a.concat( b.filter(function (item) {
        return seen.hasOwnProperty(item.id) ? false : (seen[item.id] = true);
    }));
    
}

function matchCustom(params, data) {
    // If there are no search terms, return all of the data
    if ($.trim(params.term) === '') {
        return data;
    }

    // Do not display the item if there is no 'text' property
    if (typeof data.text === 'undefined') {
        return null;
    }

    // `params.term` should be the term that is used for searching
    // `data.text` is the text that is displayed for the data object
    if (data.text.indexOf(params.term) > -1) {
        var modifiedData = $.extend({}, data, true);
        modifiedData.text += ' (matched)';

        // You can return modified objects from here
        // This includes matching the `children` how you want in nested data sets
        return modifiedData;
    }

    // Return `null` if the term should not be displayed
    return null;
}

function getAmountContent(rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder) {

    var amount= this.getColumnValue(dataIndex, column.index);
    var d = $("<div class='grid-cell' style='text-align:right'/>").width(column.width || 100)
    var currency = this._dataSource[dataIndex].currencyCode;
    d.text(Common.formatCurrenct(amount, currency,2));
    
    return d;
}
function getUrlCellContent(rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder) {

    var url = this.getColumnValue(dataIndex, column.index);
    var d = $("<div class='grid-cell'/>").width(column.width || 100);
    var lnk = $("<a target='_blank' url='" + url + "'>download</a>");
    d.append(lnk);
    lnk.on("click", e => {
        e.preventDefault();
        window.open(e.target.getAttribute("url"));
    });

    return d;
}

function getImgDisplayCellContent(rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder) {

    var name = this.getColumnValue(dataIndex, column.index);

    var imgUrl = this._dataSource[dataIndex].imageUrl;
    var d = $("<div class='grid-cell identity-cell'><img class='identity-image identity-picture small-identity' src='" + imgUrl + "' /><span class='dentity-name' style='vertical-align:top;'>"+name+"</span></div>").width(column.width || 100);
    return d;
}

function getCheckBoxContent(rowInfo, dataIndex, expandedState, level, column, indentIndex, columnOrder) {
    var col = this;
    var checked = this.getColumnValue(dataIndex, column.index);

    var imgUrl = this._dataSource[dataIndex].imageUrl;
    var d = $("<div class='grid-cell'><input type='checkbox' /> </div>").width(column.width || 100);
    d.find("input").prop("checked", checked).on("change", e => {
        col._dataSource[dataIndex].checked = !col._dataSource[dataIndex].checked;        
    });
    
    return d;
}

function findUserIdentity(id: string, allUsers: IdentityRef[]): IdentityRef {
    var ul = allUsers.filter(u => { return u.id == id })
    return ul[0]; 
}

function getUsers4Project(projectId): IPromise<CommonContracts.IdentityRef[]> {
    var deferred = $.Deferred<CommonContracts.IdentityRef[]>()
   

    var t0 = performance.now();
    var svc = CoreClient.getClient();
    var lst: CommonContracts.IdentityRef[] = [];

    svc.getTeams(projectId).then(teamList => {
        var memebersPromises: IPromise<CommonContracts.IdentityRef[]>[] = []
        teamList.forEach((t, ix) => {
                memebersPromises.push(svc.getTeamMembers(projectId, t.id));
        })

        Q.all(memebersPromises).then(identList => {
            var seen: any = {};
            console.log(" GETTING ALL USERS end data fetch took" + (performance.now() - t0));
            identList.forEach(identities => {
                lst = concatUnique(lst, identities, seen);
            })
            console.log("DONE GETTING ALL USERS took " + (performance.now() - t0));
            console.log("***********All users", lst);
            deferred.resolve(lst);

        });
    });

    return deferred.promise();
}
var lstAllUsers: CommonContracts.IdentityRef[] = null;

function getAllUsers(): IPromise < CommonContracts.IdentityRef[] > {
    var deferred = $.Deferred<CommonContracts.IdentityRef[]>()

    var t0 = performance.now();
   
    if (lstAllUsers != null) {
        console.log("***********All users already fetched resolving list ", lstAllUsers);
        deferred.resolve(lstAllUsers);
    }
    else {
        var lst: CommonContracts.IdentityRef[] = [];
        var svc = CoreClient.getClient();
        svc.getProjects().then(projects => {
            var projPromises: IPromise<CommonContracts.IdentityRef[]>[] = []
            var projectId: string[] = [];
            projects.forEach(p => {
                projPromises.push(getUsers4Project(p.id));
                projectId.push(p.id);
            });
            Q.all(projPromises).then(identList => {
                var seen: any = {};
                console.log(" GETTING ALL USERS end data fetch took" + (performance.now() - t0));
                identList.forEach(identities => {
                    lst = concatUnique(lst, identities, seen);
                })

                console.log("DONE GETTING ALL USERS took " + (performance.now() - t0));
                console.log("***********All users", lst);
                lstAllUsers = lst;
                deferred.resolve(lstAllUsers);


            });
        });
    }
    return deferred.promise();
}


class CustomIdentityClient extends Identities_Picker_RestClient.CommonIdentityPickerHttpClient {

    public constructor() {
        super("", {})
    }

    public beginGetIdentities(identitiesRequest: Identities_Picker_RestClient.IdentitiesSearchRequestModel): IPromise<Identities_Picker_RestClient.IdentitiesSearchResponseModel> {
        var deferred = $.Deferred<Identities_Picker_RestClient.IdentitiesSearchResponseModel>();
        console.log("beginGetIdentities");
        return deferred.promise();
    }

    public beginGetIdentityImageLocation(objectId: string): IPromise<string> {
        var deferred = $.Deferred<string>();
        console.log("beginGetIdentityImageLocation");
        return deferred.promise()
    }
   
    public beginGetConnections(objectId: string, getRequestParams: Identities_Picker_RestClient.IdentitiesGetConnectionsRequestModel): IPromise<Identities_Picker_RestClient.IdentitiesGetConnectionsResponseModel> {
        var deferred = $.Deferred<Identities_Picker_RestClient.IdentitiesGetConnectionsResponseModel>();
        console.log("beginGetConnections");
        return deferred.promise()
    }
    public beginGetIdentityFeatureMru(identityId: string, featureId: string, getRequestParams: Identities_Picker_RestClient.IdentitiesGetMruRequestModel): IPromise<Identities_Picker_RestClient.IdentitiesGetMruResponseModel> {
        var deferred = $.Deferred<Identities_Picker_RestClient.IdentitiesGetMruResponseModel>();
        console.log("beginGetIdentityFeatureMru");
        return deferred.promise()
    }

    public beginPatchIdentityFeatureMru(identityId: string, featureId: string, patchRequestBody: Identities_Picker_RestClient.IdentitiesPatchMruAction[]): IPromise<Identities_Picker_RestClient.IdentitiesPatchMruResponseModel> {
        var deferred = $.Deferred<Identities_Picker_RestClient.IdentitiesPatchMruResponseModel>();
        console.log("beginPatchIdentityFeatureMru");
        return deferred.promise()
    }

}


export interface IBYOLConfig {
    stripeKey: string;
    itemType: string;
    productId: string;
    marketplaceServer: IMarketplaceServer.IMarketplaceService;
    licensDataServer: ILicensServer.IExtensionLicensServer

}

export function openPurchaceDlg(config:IBYOLConfig,  licensPool: ILicensPool, mode: string, defBilling?: any): IPromise<any> {
    var deferred = $.Deferred<any>();

    Telemetry.TelemetryClient.getClient().startTrackPageView("PurchaceDlg");

    var view = this;
    var extensionContext = VSS.getExtensionContext();

    var $dlgContent = $("#dlgPurchaseFlow").clone();
    $dlgContent.show();
    $dlgContent.find("#dlgPurchaseFlow").show();

    var viewPurchDlg: LicensingPurchaseHub = new LicensingPurchaseHub();
    viewPurchDlg.srvExtLic = config.licensDataServer;
    viewPurchDlg.configBYOL= config;
    viewPurchDlg.defualtBilling = defBilling;
    viewPurchDlg.licensPool = licensPool;
    viewPurchDlg.Init($dlgContent, mode);

    var title = "Purchase subscription";
    if (mode == "StartTrial") {
        title = "Start free trial"
    }
    if (mode == "Quantity") {
        title = "Change Quantity"
    }


    var dlgOptions: Dialogs.IModalDialogOptions = {
        width: viewPurchDlg.width,
        height: viewPurchDlg.height,
        title: title,
        buttons: null,
        content: $dlgContent,
        okCallback: (result: any) => {
            var opt = null;
            deferred.resolve(opt);

        }
    };

    var dialog = Dialogs.show(Dialogs.ModalDialog, dlgOptions);
    dialog.updateOkButton(true);

    dialog.setDialogResult(true);
    viewPurchDlg.dialogHandle = dialog;
    Telemetry.TelemetryClient.getClient().stopTrackPageView("PurchaceDlg");

    return deferred.promise();
}

export function openManageLicensDlg(config: IBYOLConfig,  licensData: ILicensServer.IExtensionLicensData, mode: string): IPromise<any> {
    var deferred = $.Deferred<any>();

    Telemetry.TelemetryClient.getClient().startTrackPageView("ManageLicensDlg");

    var view = this;
    var extensionContext = VSS.getExtensionContext();

    var $dlgContent = $("#dlgManageLicensHub").clone();
    $dlgContent.show();
    $dlgContent.find("#dlgManageLicensHub").show();

    var viewManageLicensDlg: ManageLicensHub = new ManageLicensHub();
    viewManageLicensDlg.configBYOL= config;
    viewManageLicensDlg.srvExtLic = config.licensDataServer;
    viewManageLicensDlg.licensData = licensData
    viewManageLicensDlg.Init($dlgContent, mode);

    var dlgOptions: Dialogs.IModalDialogOptions = {
        width: viewManageLicensDlg.width,
        height: viewManageLicensDlg.height,
        title: "Subscriptions",
        buttons: null,
        content: $dlgContent,
        okCallback: (result: any) => {
            var opt = null;
            deferred.resolve(opt);

        }
    };

    var dialog = Dialogs.show(Dialogs.ModalDialog, dlgOptions);
    dialog.updateOkButton(true);
    dialog.setDialogResult(true);
    console.log("Setting dialog");
    viewManageLicensDlg.dialogHandle = dialog;
    Telemetry.TelemetryClient.getClient().stopTrackPageView("ManageLicensDlg");

    return deferred.promise();
}

export function openPurchace(config: IBYOLConfig): IPromise<any> {
    var deferred = $.Deferred<any>();

    Telemetry.TelemetryClient.getClient().startTrackPageView("openPurchaceDlg");

    var view = this;
    var extensionContext = VSS.getExtensionContext();

   
    config.licensDataServer.GetExtensionLicensData().then(
        data => {
            if (data.licensPools.length == 0) {
                openPurchaceDlg(config,  null, "New");
            }
            else {
                openManageLicensDlg(config,  data, "");
            }

        }
    );

    return deferred.promise();
}
