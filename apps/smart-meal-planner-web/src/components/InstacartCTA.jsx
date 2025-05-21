import React from 'react';
import { Button, Box, Typography } from '@mui/material';
import InstacartCarrotIcon from '../assets/instacart/Instacart_Carrot.png';
import InstacartLogo from '../assets/instacart/Instacart_Logo.png';

/**
 * Official Instacart CTA Button Component
 * Follows Instacart design guidelines for CTA placement and design
 */
const InstacartCTA = ({
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary', // 'primary', 'secondary', 'minimal'
  size = 'large', // 'small', 'medium', 'large'
  showLogo = true,
  children = 'Shop with Instacart',
  fullWidth = false,
  ...props
}) => {
  // Instacart brand colors
  const instacartOrange = '#F36D00';
  const instacartGreen = '#43B02A';
  const instacartHoverOrange = '#E05D00';

  // Size configurations
  const sizeConfig = {
    small: {
      height: 36,
      fontSize: '0.875rem',
      paddingX: 2,
      iconSize: 20
    },
    medium: {
      height: 44,
      fontSize: '1rem',
      paddingX: 3,
      iconSize: 24
    },
    large: {
      height: 56,
      fontSize: '1.125rem',
      paddingX: 4,
      iconSize: 28
    }
  };

  const config = sizeConfig[size];

  // Variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: instacartOrange,
          color: 'white',
          '&:hover': {
            backgroundColor: instacartHoverOrange,
          },
          '&:disabled': {
            backgroundColor: '#ccc',
            color: '#999',
          }
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          color: instacartOrange,
          border: `2px solid ${instacartOrange}`,
          '&:hover': {
            backgroundColor: instacartOrange,
            color: 'white',
          },
          '&:disabled': {
            borderColor: '#ccc',
            color: '#999',
          }
        };
      case 'minimal':
        return {
          backgroundColor: 'transparent',
          color: instacartOrange,
          '&:hover': {
            backgroundColor: 'rgba(243, 109, 0, 0.04)',
          },
          '&:disabled': {
            color: '#999',
          }
        };
      default:
        return {};
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: fullWidth ? 'stretch' : 'flex-start' }}>
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        variant="contained"
        fullWidth={fullWidth}
        sx={{
          ...getVariantStyles(),
          height: config.height,
          fontSize: config.fontSize,
          px: config.paddingX,
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          boxShadow: variant === 'primary' ? '0 4px 12px rgba(243, 109, 0, 0.25)' : 'none',
          '&:hover': {
            ...getVariantStyles()['&:hover'],
            boxShadow: variant === 'primary' ? '0 6px 16px rgba(243, 109, 0, 0.35)' : 'none',
          }
        }}
        {...props}
      >
        {showLogo && (
          <Box
            component="img"
            src={variant === 'minimal' ? InstacartLogo : InstacartCarrotIcon}
            alt="Instacart"
            sx={{
              height: config.iconSize,
              width: 'auto',
              filter: variant === 'secondary' && !disabled ? 'brightness(0) saturate(100%) invert(46%) sepia(86%) saturate(1836%) hue-rotate(21deg) brightness(96%) contrast(97%)' : 'none'
            }}
          />
        )}
        {loading ? 'Loading...' : children}
      </Button>
      
      {/* Attribution text as required by Instacart guidelines */}
      <Typography
        variant="caption"
        sx={{
          mt: 0.5,
          color: 'text.secondary',
          fontSize: '0.75rem',
          alignSelf: fullWidth ? 'center' : 'flex-start'
        }}
      >
        Powered by Instacart
      </Typography>
    </Box>
  );
};

export default InstacartCTA;