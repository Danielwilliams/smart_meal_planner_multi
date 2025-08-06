import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarHalfIcon from '@mui/icons-material/StarHalf';

const StarRating = ({
  value = 0,
  onChange = null,
  max = 5,
  size = 'medium',
  precision = 1, // 1 = whole stars, 0.5 = half stars
  showValue = true,
  showCount = false,
  count = 0,
  label = '',
  readOnly = false,
  color = 'primary'
}) => {
  const [hoverValue, setHoverValue] = useState(null);
  
  const isInteractive = !readOnly && onChange;
  const displayValue = hoverValue !== null ? hoverValue : value;
  
  // Calculate star size based on size prop
  const getStarSize = () => {
    switch (size) {
      case 'small': return { fontSize: '1rem' };
      case 'large': return { fontSize: '2rem' };
      case 'medium':
      default: return { fontSize: '1.5rem' };
    }
  };
  
  // Get star icon based on value
  const getStarIcon = (starIndex) => {
    const starValue = starIndex + 1;
    const diff = displayValue - starIndex;
    
    if (diff >= 1) {
      return <StarIcon sx={getStarSize()} />;
    } else if (diff >= 0.5 && precision === 0.5) {
      return <StarHalfIcon sx={getStarSize()} />;
    } else {
      return <StarBorderIcon sx={getStarSize()} />;
    }
  };
  
  // Handle star click
  const handleStarClick = (starIndex) => {
    console.log('🐛 DEBUG: StarRating handleStarClick called with starIndex:', starIndex);
    console.log('🐛 DEBUG: isInteractive:', isInteractive);
    console.log('🐛 DEBUG: readOnly:', readOnly);
    console.log('🐛 DEBUG: onChange exists:', !!onChange);
    console.log('🐛 DEBUG: onChange type:', typeof onChange);
    
    if (!isInteractive) {
      console.log('🐛 DEBUG: StarRating click ignored - not interactive');
      return;
    }
    
    const newValue = starIndex + 1;
    console.log('🐛 DEBUG: StarRating calling onChange with newValue:', newValue);
    onChange(newValue);
  };
  
  // Handle star hover
  const handleStarHover = (starIndex) => {
    if (!isInteractive) return;
    setHoverValue(starIndex + 1);
  };
  
  // Handle mouse leave
  const handleMouseLeave = () => {
    if (!isInteractive) return;
    setHoverValue(null);
  };
  
  return (
    <Box 
      display="flex" 
      alignItems="center" 
      gap={0.5}
      onMouseLeave={handleMouseLeave}
    >
      {label && (
        <Typography variant="body2" sx={{ mr: 1 }}>
          {label}:
        </Typography>
      )}
      
      <Box display="flex" alignItems="center">
        {[...Array(max)].map((_, index) => (
          <Box
            key={index}
            sx={{
              cursor: isInteractive ? 'pointer' : 'default',
              color: displayValue > index 
                ? `${color}.main` 
                : 'action.disabled',
              transition: 'color 0.2s ease',
              '&:hover': isInteractive ? {
                color: `${color}.dark`
              } : {}
            }}
            onClick={(e) => {
              console.log('🐛 DEBUG: Star Box clicked, index:', index);
              e.preventDefault();
              e.stopPropagation();
              handleStarClick(index);
            }}
            onMouseEnter={() => handleStarHover(index)}
          >
            {getStarIcon(index)}
          </Box>
        ))}
      </Box>
      
      {showValue && value > 0 && (
        <Typography 
          variant="body2" 
          sx={{ ml: 1, color: 'text.secondary' }}
        >
          {value.toFixed(1)}
        </Typography>
      )}
      
      {showCount && count > 0 && (
        <Typography 
          variant="body2" 
          sx={{ ml: 0.5, color: 'text.secondary' }}
        >
          ({count})
        </Typography>
      )}
    </Box>
  );
};

export default StarRating;