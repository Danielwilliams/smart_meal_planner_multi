import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Divider,
  Chip
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

const PaymentProviderSelector = ({ selectedProvider, onProviderChange, disabled = false }) => {
  const handleProviderChange = (event) => {
    onProviderChange(event.target.value);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Choose Payment Method
      </Typography>
      
      <FormControl component="fieldset" disabled={disabled} fullWidth>
        <RadioGroup
          value={selectedProvider}
          onChange={handleProviderChange}
          name="payment-provider"
        >
          {/* Stripe Option */}
          <Card 
            variant="outlined" 
            sx={{ 
              mb: 2, 
              border: selectedProvider === 'stripe' ? 2 : 1,
              borderColor: selectedProvider === 'stripe' ? 'primary.main' : 'grey.300',
              '&:hover': {
                borderColor: 'primary.main',
                cursor: 'pointer'
              }
            }}
            onClick={() => !disabled && onProviderChange('stripe')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    value="stripe"
                    control={<Radio />}
                    label=""
                    sx={{ mr: 1 }}
                  />
                  <CreditCardIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h6" component="div">
                      Credit Card
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Visa, Mastercard, American Express, and more
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip 
                    label="Recommended" 
                    color="primary" 
                    size="small" 
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Powered by Stripe
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* PayPal Option */}
          <Card 
            variant="outlined" 
            sx={{ 
              mb: 2, 
              border: selectedProvider === 'paypal' ? 2 : 1,
              borderColor: selectedProvider === 'paypal' ? 'primary.main' : 'grey.300',
              '&:hover': {
                borderColor: 'primary.main',
                cursor: 'pointer'
              }
            }}
            onClick={() => !disabled && onProviderChange('paypal')}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    value="paypal"
                    control={<Radio />}
                    label=""
                    sx={{ mr: 1 }}
                  />
                  <AccountBalanceIcon sx={{ mr: 2, color: '#0070ba' }} />
                  <Box>
                    <Typography variant="h6" component="div">
                      PayPal
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pay with your PayPal account or linked payment methods
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box 
                    component="img" 
                    src="/assets/paypal-logo.png" 
                    alt="PayPal" 
                    sx={{ 
                      height: 24, 
                      mr: 1,
                      // Fallback for missing image
                      display: 'none'
                    }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#0070ba', 
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}
                  >
                    PayPal
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </RadioGroup>
      </FormControl>

      {/* Additional Information */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Secure Payment:</strong> All payments are processed securely using industry-standard encryption. 
          Your payment information is never stored on our servers.
        </Typography>
      </Box>
    </Box>
  );
};

export default PaymentProviderSelector;