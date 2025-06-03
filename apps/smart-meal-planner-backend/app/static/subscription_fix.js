/**
 * Defensive programming utility for the frontend to safely handle null/undefined values
 * in subscription and invoice data
 * 
 * Include this script in your React application to prevent UI crashes when
 * accessing subscription or invoice fields.
 */

// Safe string access functions
window.safeString = function(value, defaultValue = '') {
  return typeof value === 'string' ? value : (defaultValue || '');
};

window.safeToLowerCase = function(value, defaultValue = '') {
  return window.safeString(value, defaultValue).toLowerCase();
};

window.safeNumber = function(value, defaultValue = 0) {
  return typeof value === 'number' ? value : (defaultValue || 0);
};

// Patch String.prototype.toLowerCase safely
const originalToLowerCase = String.prototype.toLowerCase;
String.prototype.toLowerCase = function() {
  // Only call the original method if 'this' is actually a string
  if (typeof this === 'string') {
    return originalToLowerCase.call(this);
  }
  // Return empty string for null/undefined
  return '';
};

// Safe data accessors for subscription data
window.SafeSubscriptionData = {
  status: function(subscription) {
    return window.safeString(subscription?.status, 'unknown');
  },
  
  currency: function(subscription) {
    return window.safeString(subscription?.currency, 'usd').toLowerCase();
  },
  
  type: function(subscription) {
    return window.safeString(subscription?.subscription_type, 'free');
  },
  
  amount: function(subscription) {
    return window.safeNumber(subscription?.monthly_amount, 0);
  }
};

// Safe data accessors for invoice data
window.SafeInvoiceData = {
  status: function(invoice) {
    return window.safeString(invoice?.status, 'unknown');
  },
  
  currency: function(invoice) {
    return window.safeString(invoice?.currency, 'usd').toLowerCase();
  },
  
  amountDue: function(invoice) {
    return window.safeNumber(invoice?.amount_due, 0);
  },
  
  amountPaid: function(invoice) {
    return window.safeNumber(invoice?.amount_paid, 0);
  },
  
  invoiceNumber: function(invoice) {
    return window.safeString(invoice?.invoice_number, 'UNKNOWN');
  }
};

// Monkey patch to make all API responses safer
if (window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // Clone the original response methods
    const originalJson = response.json;
    
    // Override the json method to sanitize subscription data
    response.json = async function() {
      const data = await originalJson.call(this);
      
      // Sanitize subscription data if it exists
      if (data && typeof data === 'object') {
        // Handle status field
        if (data.status === null || data.status === undefined) {
          data.status = 'unknown';
        }
        
        // Handle currency field
        if (data.currency === null || data.currency === undefined) {
          data.currency = 'usd';
        }
        
        // Handle invoices array
        if (Array.isArray(data.invoices)) {
          data.invoices = data.invoices.map(invoice => {
            if (invoice && typeof invoice === 'object') {
              // Ensure all required fields exist
              return {
                ...invoice,
                status: invoice.status || 'unknown',
                currency: invoice.currency || 'usd',
                amount_due: typeof invoice.amount_due === 'number' ? invoice.amount_due : 0,
                amount_paid: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0,
                invoice_number: invoice.invoice_number || 'UNKNOWN'
              };
            }
            return invoice;
          });
        }
      }
      
      return data;
    };
    
    return response;
  };
}

// Log that the fix script has been loaded
console.log('Subscription data protection script loaded successfully');