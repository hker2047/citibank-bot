class CitiDriver {
    
    constructor() {
        this.tabId = null;
    }

    setTabId(tabId) {
        this.tabId = tabId;
    }

    async * createPaymentProcess(params) {
        yield await this.gotoPaymentPlatform();
        yield await this.gotoBillPaymentSection();
        yield await this.openPayBillsForm();

        var amountRowOffset;
        if (params.billType == 'REGISTERED_PAYEE') {
            yield await this.selectRegisteredPayeeBill(params.payeeName);
            amountRowOffset = 0;
        } else if (params.billType == 'TAX') {
            yield await this.selectTaxBill(params.taxAccountNumber);
            amountRowOffset = 1;
        }
        yield await this.fillAmountAndSelectAccount(params.payAmount, params.payAccount, amountRowOffset);
        yield await this.proceedPayment()
        yield await this.confirmPayment();
    }

    delay(timeMs) {
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(), timeMs);
        });
    }

    waitForPageUpdate() {
        return new Promise((resolve, reject) => {
            const requiredTabId = this.tabId;
            function listener(tabId, changeInfo, tab) {
                if (tabId == requiredTabId && changeInfo.status == 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    executeScript(code) {
        return new Promise((resolve, reject) => {
            chrome.tabs.executeScript(this.tabId, { code }, (result) => {
                resolve(result[0]);
            });
        });
    }

    async executeScriptAndCheckError(code) {
        const errorMessage = await this.executeScript(`
            try {
                ${code}
                null
            } catch (error) {
                error.message
            }
        `);
        if (errorMessage) {
            throw new Error(errorMessage);
        }
    }

    async gotoPaymentPlatform() {
        await this.executeScriptAndCheckError(`
            var paymentPlatformNav = document.querySelector('#cmlink_lk_paymentsTransfers');
            if (!paymentPlatformNav) {
                throw new Error("Payment platform link not found in page");
            }
            paymentPlatformNav.click();
            
        `);
        await this.waitForPageUpdate();

    }

    async gotoBillPaymentSection() {
        await this.executeScriptAndCheckError(`
            var billPaymentNav = document.querySelector('#menuWidget1 a');
            if (!billPaymentNav) {
                throw new Error("Bill payment link not found in page");
            }
                billPaymentNav.querySelector('a').click();
            
        `);
    }

    async openPayBillsForm() {
        await this.executeScriptAndCheckError(`
            var payBillsNavLink = document.querySelector('#menuWidget8');
            if (!payBillsNavLink) {
                throw new Error("Pay bills link not found in page");
            }
            payBillsNavLink.click();
        `);
        await this.waitForPageUpdate();
    }

    async selectRegisteredPayeeBill(payeeName) {
        await this.executeScriptAndCheckError(`
            var payeeDropdown = document.querySelector('.commonForm2 .commonForm2 > tbody > tr:nth-child(2) > td:nth-child(2) > div.ui-dropDown-btn');
            if (!payeeDropdown) {
                throw new Error("Payee dropdown not found in page");
            }
            payeeDropdown.click();
                
            var payeeOptions = document.querySelectorAll('.commonForm2 .commonForm2 > tbody > tr:nth-child(2) > td:nth-child(2) > div.boxOpened td');
            var filteredPayeeOptions = Array.from(payeeOptions)
                .filter(o => o.innerText.includes('${payeeName}'));
            if (filteredPayeeOptions.length == 0) {
                throw new Error("No matched payee found in payee dropdown");
            } else if (filteredPayeeOptions.length > 1) {
                throw new Error("Multiple matched payees found in payee dropdown");
            }
            filteredPayeeOptions[0].click();
        `);
        await this.waitForPageUpdate();
    }

    async selectTaxBill(taxAccountNumber) {
        await this.executeScriptAndCheckError(`
	   var billAccountNumberDropdown = document.querySelector('#toAccount_button');
            billAccountNumberDropdown.click();

            if (!billAccountNumberDropdown) {
                throw new Error("Tax account dropdown not found in page");
            }
             billAccountNumberDropdown.click();

            var billAccountNumberOptions =document.querySelectorAll('#toAccount_button');
            var filteredBillAccountNumberOptions = Array.from(billAccountNumberOptions)
                .filter(o => o.innerText.includes('${taxAccountNumber}'));
            if (filteredBillAccountNumberOptions.length == 0) {
                throw new Error("No matched account found in tax account dropdown");
            } else if (filteredBillAccountNumberOptions.length > 1) {
                throw new Error("Multiple matched accounts found in tax account dropdown");
            }
            filteredBillAccountNumberOptions[0].click();
        `);

        await this.waitForPageUpdate();

    }

    async fillAmount(payAmount, amountRowOffset) {
        await this.executeScriptAndCheckError(`
            var amountInput = document.querySelector('#firstTransactionAmount');
            if (!amountInput) {
                throw new Error("Amount input not found in page");
            }
            amountInput.value = '${payAmount}';

            var deductFromAccountDropdown = document.querySelector('#fromAccount_input');
            if (!deductFromAccountDropdown) {
                throw new Error("Deduct-from-account dropdown not found in page");
            }
            deductFromAccountDropdown.click();

            var deductFromAccountOptions = document.querySelectorAll('#fromAccount_input');
            var filteredDeductFromAccountOptions = Array.from(deductFromAccountOptions)
                .filter(o => o.innerText.includes('${payAccount}'));
            if (filteredDeductFromAccountOptions.length == 0) {
                throw new Error("No matched account found in deduct-from-account dropdown");
            } else if (filteredDeductFromAccountOptions.length > 1) {
                throw new Error("Multiple matched accounts found in deduct-from-account dropdown");
            }
            filteredDeductFromAccountOptions[0].click();
        `);
        await this.waitForPageUpdate();
    }
    
    async proceedPayment() {
        await this.executeScriptAndCheckError(`
            var proceedButton = document.querySelector('a#okBtn');
            if (!proceedButton) {
                throw new Error("Proceed button not found in page");
            }
            proceedButton.click();
        `);
        await this.waitForPageUpdate();
        await this.executeScriptAndCheckError(`
            var errorHeadings = document.querySelectorAll('.errorheading');
            if (errorHeadings.length > 0) {
                throw new Error("Error message found in page");
            }

            var systemMessage = document.querySelector('#importantNotes2');
            if (systemMessage && systemMessage.innerText.length > 0) {
                throw new Error("Unexpected system message found in page");
            }
        `);
    }

    async confirmPayment() {
        await this.executeScriptAndCheckError(`
            var confirmButton = document.querySelector('.btn-grn-1 a');
            if (!confirmButton) {
                throw new Error("Confirm button not found in page");
            }
            confirmButton.click();
        `);
        await this.waitForPageUpdate();
        await this.executeScriptAndCheckError(`
            var paymentMessage = document.querySelector('#errorMessage span.blue');
            if (!paymentMessage || paymentMessage.innerText.length == 0) {
                throw new Error("Transaction completed message not found in page");
            }
        `);
    }

}