# Azure DevOps Extensions BYOL 
Azure DevOps Extension BYOL is a library for publishers who want to build a BYOL solution to publish comemrcial Azure DevOps extensions.

## Features 
+ In app purchase flow
+ Licens validation 
+ Extensible architecture to supports your licensing types & backend solutions

## Currently supported
+ Named user & enterprise licensing
+ ChargeBee + Stripe backend
+ Licens data stored in Azure DevOps extensions storage 

## Planned 
+ Support Team and Project licensing
+ Stripe backend (?)
+ Local cache of licensChecks to support disconnected clients


## Usage 
```typescript
  var config: IBYOLConfig = {
                            stripeKey: "[Your Stripe Key]",
                            productId: "Enhanced Export PRO",
                            itemType: "User",
                            marketplaceServer: new MarketplaceServer.chargeBeeMarketplaceService(),
                            licensDataServer: new LicensServer.ExtDataLicensServer()
                            };
                            
   LicensingPurchaseHub.openPurchace(config);
   
   
   if(LicensingPurchaseHub.isLicensed()){
    //enable feature 
   }
            
```


## Contributions
Here is how you can contribute to this project:
+ Fork the repo and submit pull requests for bug fixes and features
+ Submit bugs and help us verify fixes
+ Discuss existing issues/proposals
+ Test and share migration configurations
Please refer to Contribution guidelines and the Code of Conduct for more details.
