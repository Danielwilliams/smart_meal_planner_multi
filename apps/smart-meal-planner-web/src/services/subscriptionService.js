// src/services/subscriptionService.js
import apiService from './apiService';

// Check which methods are available in apiService
const availableMethods = Object.keys(apiService);
console.log('Available methods in apiService:', availableMethods);

// Helper function to determine the best API method to use
const getApiMethod = () => {
  // List of possible method names in order of preference
  const possibleMethods = [
    'fetchWithAuth',
    'post',
    'get',
    'put',
    'patch',
    'delete',
    'request',
    'makeAuthenticatedRequest',
    'makeRequest'
  ];

  for (const method of possibleMethods) {
    if (typeof apiService[method] === 'function') {
      console.log(`Using apiService.${method} for subscription requests`);
      return method;
    }
  }

  // Fallback to checking if apiService itself is a function
  if (typeof apiService === 'function') {
    console.log('Using apiService directly as a function');
    return 'direct';
  }

  console.error('No suitable API method found in apiService');
  return null;
}

// Determine the best API method once
const apiMethod = getApiMethod();

// Function to make API requests based on available methods
const makeApiRequest = async (endpoint, options = {}) => {
  if (!apiMethod) {
    throw new Error('No suitable API method available');
  }

  // Ensure the endpoint starts with /api/
  let url = endpoint;
  if (!url.startsWith('/api/')) {
    url = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
  }
  console.log(`Making API request to: ${url}`);

  try {
    if (apiMethod === 'direct') {
      // If apiService is a function itself
      return await apiService(url, options);
    }
    else if (apiMethod === 'fetchWithAuth') {
      return await apiService.fetchWithAuth(url, options);
    }
    else if (apiMethod === 'request') {
      return await apiService.request(url, options);
    }
    else if (apiMethod === 'makeAuthenticatedRequest') {
      return await apiService.makeAuthenticatedRequest(url, options);
    }
    else if (apiMethod === 'makeRequest') {
      return await apiService.makeRequest(url, options);
    }
    else if (apiMethod === 'post' && options.method === 'POST') {
      return await apiService.post(url, options.body ? JSON.parse(options.body) : {});
    }
    else if (apiMethod === 'get' && (!options.method || options.method === 'GET')) {
      return await apiService.get(url);
    }
    else if (apiMethod === 'put' && options.method === 'PUT') {
      return await apiService.put(url, options.body ? JSON.parse(options.body) : {});
    }
    else if (apiMethod === 'patch' && options.method === 'PATCH') {
      return await apiService.patch(url, options.body ? JSON.parse(options.body) : {});
    }
    else if (apiMethod === 'delete' && options.method === 'DELETE') {
      return await apiService.delete(url, options.body ? JSON.parse(options.body) : {});
    }
    else {
      // Fallback to using whatever method we found with GET
      return await apiService[apiMethod](url, options);
    }
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    throw error;
  }
};

const subscriptionService = {
  /**
   * Get the current subscription status for the user
   * @returns {Promise<Object>} Subscription status data
   */
  async getSubscriptionStatus() {
    try {
      const response = await makeApiRequest('/api/subscriptions/status');
      return response;
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw error;
    }
  },

  /**
   * Create a checkout session for a new subscription
   * @param {string} subscriptionType - Type of subscription (individual or organization)
   * @param {string} paymentProvider - Payment provider (stripe or paypal)
   * @param {string} successUrl - URL to redirect after successful payment
   * @param {string} cancelUrl - URL to redirect after cancelled payment
   * @returns {Promise<Object>} Checkout session data
   */
  async createCheckoutSession(subscriptionType, paymentProvider, successUrl, cancelUrl) {
    try {
      const payload = {
        subscription_type: subscriptionType,
        payment_provider: paymentProvider,
        success_url: successUrl,
        cancel_url: cancelUrl
      };

      console.log('Creating checkout session with payload:', payload);

      const response = await makeApiRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      console.log('Checkout session response:', response);
      return response;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  },

  /**
   * Cancel the current subscription
   * @param {boolean} cancelAtPeriodEnd - Whether to cancel at the end of the billing period
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(cancelAtPeriodEnd = true) {
    try {
      const response = await makeApiRequest('/api/subscriptions/cancel', {
        method: 'POST',
        body: JSON.stringify({
          cancel_at_period_end: cancelAtPeriodEnd
        })
      });
      return response;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  },

  /**
   * Get list of invoices for the current user
   * @returns {Promise<Array>} List of invoices
   */
  async getInvoices() {
    try {
      const response = await makeApiRequest('/api/subscriptions/invoices');
      return response;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  },

  /**
   * Update the payment method for the current subscription
   * @param {string} paymentMethodId - ID of the new payment method
   * @returns {Promise<Object>} Update result
   */
  async updatePaymentMethod(paymentMethodId) {
    try {
      const response = await makeApiRequest('/api/subscriptions/update-payment-method', {
        method: 'POST',
        body: JSON.stringify({
          payment_method_id: paymentMethodId
        })
      });
      return response;
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  },

  /**
   * Get list of available subscription plans
   * @returns {Promise<Array>} List of subscription plans
   */
  async getSubscriptionPlans() {
    try {
      const response = await makeApiRequest('/api/subscriptions/plans');
      return response;
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      throw error;
    }
  }
};

export default subscriptionService;