// src/services/subscriptionService.js
import apiService from './apiService';

const subscriptionService = {
  /**
   * Get the current subscription status for the user
   * @returns {Promise<Object>} Subscription status data
   */
  async getSubscriptionStatus() {
    try {
      const response = await apiService.fetchWithAuth('/subscriptions/status');
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
      const response = await apiService.fetchWithAuth('/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          subscription_type: subscriptionType,
          payment_provider: paymentProvider,
          success_url: successUrl,
          cancel_url: cancelUrl
        })
      });
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
      const response = await apiService.fetchWithAuth('/subscriptions/cancel', {
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
      const response = await apiService.fetchWithAuth('/subscriptions/invoices');
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
      const response = await apiService.fetchWithAuth('/subscriptions/update-payment-method', {
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
      const response = await apiService.fetchWithAuth('/subscriptions/plans');
      return response;
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      throw error;
    }
  }
};

export default subscriptionService;