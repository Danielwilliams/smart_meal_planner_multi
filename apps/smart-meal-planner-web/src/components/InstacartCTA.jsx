import React from 'react';
import { Button, Box, Typography } from '@mui/material';
import InstacartCarrotIcon from '../assets/instacart/Instacart_Carrot.png';
import InstacartLogo from '../assets/instacart/Instacart_Logo.png';

/**
 * Official Instacart CTA Button Component
 * Following precise Instacart design guidelines for CTA placement and design
 *
 * Per official Instacart guidelines:
 * - Button Height: 46px (fixed)
 * - Button Width: Dynamic based on text
 * - Approved texts: "Shop with Instacart", "Get Ingredients", "Order with Instacart", "Get Recipe Ingredients"
 * - Logo Size: 22px (fixed)
 * - Fully rounded corners
 * - Dark green background (#003D29)
 * - Light text color (#FAF1E5)
 */
const InstacartCTA = ({
  onClick,
  disabled = false,
  loading = false,
  showLogo = true,
  children = 'Shop with Instacart', // Must be one of the approved texts only
  fullWidth = false,
  ...props
}) => {
  // Official Instacart brand colors
  const instacartDark = '#003D29';      // Dark background
  const instacartText = '#FAF1E5';      // Text color
  const instacartOrange = '#FF7009';    // Logo orange
  const instacartGreen = '#0AAD0A';     // Logo green

  // Official size configuration (per guidelines)
  const sizeConfig = {
    // We'll only have one size according to the official guidelines
    standard: {
      height: 46,                      // Exact height from guidelines
      paddingY: '16px',                // Vertical padding from guidelines
      paddingX: '18px',                // Horizontal padding from guidelines
      fontSize: '1rem',                // Standard size for text
      iconSize: 22                     // Logo size from guidelines
    }
  };

  // Use standard size only

  // Official dark variant style (per guidelines)
  const getButtonStyle = () => {
    return {
      backgroundColor: instacartDark,
      color: instacartText,
      '&:hover': {
        backgroundColor: '#002A1C', // Slightly darker for hover state
      },
      '&:disabled': {
        backgroundColor: '#ccc',
        color: '#999',
      }
    };
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: fullWidth ? 'stretch' : 'flex-start' }}>
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        variant="contained"
        fullWidth={fullWidth}
        sx={{
          ...getButtonStyle(),
          height: sizeConfig.standard.height,
          fontSize: sizeConfig.standard.fontSize,
          py: sizeConfig.standard.paddingY,
          px: sizeConfig.standard.paddingX,
          fontWeight: 500,
          textTransform: 'none',
          borderRadius: '999px', // Fully rounded button
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          boxShadow: 'none',
          '&:hover': {
            ...getButtonStyle()['&:hover'],
          }
        }}
        {...props}
      >
        {showLogo && (
          <Box
            component="img"
            src={InstacartCarrotIcon}
            alt="Instacart"
            sx={{
              height: sizeConfig.standard.iconSize,
              width: 'auto',
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