/**
 * Global State Management (Single Source of Truth)
 * Menyimpan seluruh data real-time aplikasi.
 */
import { APP_CONFIG } from '../config/constants.js';

export const AuraState = {
    user: { uid: null, profile: {}, isAnonymous: false },
    system: {
        theme: APP_CONFIG.DEFAULT_THEME,
        activeView: 'dashboard',
        isProcessing: false,
        exchangeRateIDR: 105,
        displayCurrency: APP_CONFIG.DEFAULT_CURRENCY,
        base64Upload: "",
        isRatesLoaded: false,
        isOnline: navigator.onLine,
        hasShownBudgetAlert: false 
    },
    filters: {
        search: '', category: 'ALL', user: 'ALL', periodMode: 'month' 
    },
    data: {
        transactions: [], trash: [], goals: [], groqKeys: [],
        oracleChats: [], settings: {}, monthlyBudget: 100000, familyMembers: []
    },
    temp: {
        deleteTarget: null, editItemTarget: null, editTrxTarget: null,
        addItemTargetTrxId: null, editRecurringTarget: null, expandedReceipts: {}, 
        budgetUpdateTimer: null, aiStaging: null, isProcessingRecurring: false 
    },
    instances: { firebaseApp: null, db: null, auth: null, geminiEngine: null },
    listeners: [] 
};

export const bindGlobalStateProperty = function(globalName, statePath) {
    Object.defineProperty(window, globalName, {
        get: function() {
            const parts = statePath.split('.');
            let context = AuraState;
            for (let i = 0; i < parts.length; i++) {
                if (context === undefined || context === null) return undefined;
                context = context[parts[i]];
            }
            return context;
        },
        set: function(value) {
            const parts = statePath.split('.');
            let context = AuraState;
            for (let i = 0; i < parts.length - 1; i++) {
                if (context[parts[i]] === undefined) context[parts[i]] = {};
                context = context[parts[i]];
            }
            context[parts[parts.length - 1]] = value;
        },
        configurable: true
    });
};

// Global Exposure untuk fungsi UI (HTML onclick)
window.AuraState = AuraState;

// Pemetaan State Langsung ke Objek Global
bindGlobalStateProperty('allTransactions', 'data.transactions');
bindGlobalStateProperty('trashTransactions', 'data.trash');
bindGlobalStateProperty('allGoals', 'data.goals');
bindGlobalStateProperty('monthlyBudget', 'data.monthlyBudget');
bindGlobalStateProperty('settingsData', 'data.settings');
bindGlobalStateProperty('rawGroqKeysData', 'data.groqKeys');
bindGlobalStateProperty('oracleChats', 'data.oracleChats');
bindGlobalStateProperty('currentTheme', 'system.theme');
bindGlobalStateProperty('activeView', 'system.activeView');
bindGlobalStateProperty('displayCurrency', 'system.displayCurrency');
bindGlobalStateProperty('exchangeRateIDR', 'system.exchangeRateIDR');
bindGlobalStateProperty('isRatesLoaded', 'system.isRatesLoaded');
bindGlobalStateProperty('isProcessing', 'system.isProcessing');
bindGlobalStateProperty('base64Upload', 'system.base64Upload');
bindGlobalStateProperty('deleteTargetData', 'temp.deleteTarget');
bindGlobalStateProperty('editItemTargetData', 'temp.editItemTarget');
bindGlobalStateProperty('editTrxTargetData', 'temp.editTrxTarget');
bindGlobalStateProperty('addItemTargetTrxId', 'temp.addItemTargetTrxId');
bindGlobalStateProperty('aiStaging', 'temp.aiStaging');
