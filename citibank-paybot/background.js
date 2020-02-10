const paymentDriver = new CitiDriver();

const storageKeys = [
    'billType',
    'payeeName',
    'payAccount',
    'taxAccountNumber',
    'payAmount',
    'payCount',
    'totalPaid'
];

var params;
var currentPayLoop;
var totalPaid = 0;

chrome.storage.sync.get(storageKeys, function(result) {
    params = {
        billType: result.billType || 'REGISTERED_PAYEE',
        payeeName: result.payeeName || '',
        payAccount: result.payAccount || '',
       taxAccountNumber: result.taxAccountNumber || '',
       payAmount: result.payAmount || 1,
        payCount: result.payCount || 1  
    };
    totalPaid = parseFloat(result.totalPaid || '0');
});

function delay(timeMs) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), timeMs);
    });
}

function storageSet(config) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(config, () => {
            resolve();
        });
    });
}

function getActiveTab() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({currentWindow: true, active: true}, function(tabs) {
            resolve(tabs[0]);
        });
    });
}

async function setParams(newParams) {
    Object.assign(params, newParams);
    await storageSet(params);
}

async function start({payAmount, payCount}) {
    currentPayLoop = {
        stopping: false,
        stopped: false,
        payCount,
        paymentMade: 0,
        errorMessage: null
    };
    chrome.browserAction.setIcon({path:"icon-active.png"});

    try {
        chrome.runtime.sendMessage({
            "type": "update",
            "paymentMade": currentPayLoop.paymentMade,
        });

        const activeTab = await this.getActiveTab();
        paymentDriver.setTabId(activeTab.id);

        for (var i = 0; i < payCount; i++) {
            if (i > 0) {
                await delay(2000);
            }

            if (currentPayLoop.stopping) {
                break;
            }

            var paymentProcess = paymentDriver.createPaymentProcess({
                billType: params.billType,
                payeeName: params.payeeName,
                payAccount: params.payAccount,
                taxAccountNumber: params.taxAccountNumber,
               payAmount: params.payAmount
            });

            while (!currentPayLoop.stopping) {
                var result = await paymentProcess.next();
                if (result.done) {
                    currentPayLoop.paymentMade++;
            
                    totalPaid += payAmount;
                    chrome.storage.sync.set({ totalPaid: totalPaid });
        
                    chrome.runtime.sendMessage({
                        "type": "update",
                        "paymentMade": currentPayLoop.paymentMade,
                    });        
                    break;
                }
            }
        }

        currentPayLoop.stopped = true;
        currentPayLoop.stopping = false;
        chrome.runtime.sendMessage({ "type": "completed" });
        chrome.browserAction.setIcon({path:"icon-idle.png"});
    } catch (error) {
        console.log("Failed in payment", error);
        currentPayLoop.stopped = true;
        currentPayLoop.stopping = false;
        currentPayLoop.errorMessage = error.message;
        chrome.runtime.sendMessage({ "type": "failed", "errorMessage": error.message });
        chrome.browserAction.setIcon({path:"icon-idle.png"});
    }
}

function stop() {
    currentPayLoop.stopping = true;
}

function queryStatus() {
    return({
        success: true,
        params,
        currentPayLoop: currentPayLoop,
        totalPaid
    });
}

async function resetCounter() {
    totalPaid = 0;
    await storageSet({ totalPaid: totalPaid });
}